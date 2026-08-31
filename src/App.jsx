import React, { useState, useEffect, useRef, useMemo } from "react";
import { auth, db } from "./firebase";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  updateProfile,
  sendEmailVerification,
  sendPasswordResetEmail,
} from "firebase/auth";
import {
  doc,
  setDoc,
  getDoc,
  collection,
  addDoc,
  query as fsQuery,
  where,
  orderBy,
  limit,
  onSnapshot,
  serverTimestamp,
} from "firebase/firestore";

/* ---------------------------------------------------------
   TOKENS
   Ink:      #0B322D   background
   Pine:     #0F3E37   surface / cards
   Mint:     #17D897   primary accent
   Pale:     #9CF3D6   secondary accent / muted headlines
   Paper:    #F3F5F0   light text / paper
   Charcoal: #0B1F1B   deep text on paper
--------------------------------------------------------- */

const T = {
  ink: "#04211D",
  pine: "#0C332C",
  pineLight: "#134A41",
  mint: "#17D897",
  mintDim: "#0FA377",
  pale: "#9CF3D6",
  paper: "#F3F5F0",
  charcoal: "#0B1F1B",
  line: "rgba(243,245,240,0.14)",
};

// Options shown in the "favorite genre" dropdown on the signup form.
// This is just a personal-preference list for user profiles — it has
// nothing to do with the video catalog below. Add/remove freely.
const PROFILE_GENRE_OPTIONS = ["Tagalog", "English", "Korean", "Japanese", "French"];

// Preferred display order for quality tiers. Anything in a title's
// `quality` array that ISN'T listed here still works — it just gets
// sorted to the end of the filter list alphabetically.
const QUALITY_ORDER = ["720p", "1080p", "HD", "4K", "8K"];

const CATEGORY_ICON = {
  Action: "\u2694\ufe0f",
  Drama: "\ud83c\udff5\ufe0f",
  Comedy: "\ud83c\udfad",
  Thriller: "\ud83d\udd26",
  Romance: "\ud83e\udd41",
  "Sci-Fi": "\ud83c\udf0c",
  Documentary: "\ud83d\udcf0",
  Horror: "\ud83c\udf19",
  Animation: "\ud83c\udfa8",
  Musical: "\ud83c\udfb5",
};

const GRADIENTS = [
  ["#0F3E37", "#17D897"],
  ["#0B322D", "#9CF3D6"],
  ["#134A41", "#17D897"],
  ["#0B322D", "#17D897"],
  ["#0F3E37", "#9CF3D6"],
];

function grad(i) {
  const [a, b] = GRADIENTS[i % GRADIENTS.length];
  const angle = 120 + (i % 4) * 15;
  return `linear-gradient(${angle}deg, ${a}, ${b})`;
}

/* ===========================================================
   VIDEO CATALOG — add new titles here
   ===========================================================
   Every title is a plain object with named fields, so you can
   add or edit one without counting array positions. Copy the
   TEMPLATE below, paste it into the TITLES array, and fill it in.

   POSTERS — easy mode:
     Drop your image anywhere in /public/posters/ and set
     `poster` to its exact filename (e.g. "poster: my-movie.jpg").
     The filename does NOT need to match the title anymore.
     If you leave `poster` blank/omitted, it falls back to an
     auto-generated slug of the title (old behavior), so existing
     entries that relied on that still work unchanged.

   TAGS shown on the card/detail page (e.g. "Movie, Drama, 2026,
   Thailand, HD") are built automatically from `type`, `category`,
   `year`, `language`, and `quality` below — just fill those in
   and the tags update themselves, no separate list to maintain.

   RATING BADGES — each title has its own on/off switches:
     showRt:   true/false  -> show the Rotten-Tomatoes-style badge
     showImdb: true/false  -> show the IMDb badge
     Turn on whichever ones you actually have a score for. Both
     can be true, both false, or just one — independent of each other.

   -----------------------------------------------------------
   TEMPLATE (copy/paste, then fill in):

   {
     title: "New Title Here",
     poster: "",              // filename in /public/posters/, or "" to auto-generate
     type: "movie",           // "movie" | "tv"
     category: "Drama",       // Action, Drama, Comedy, Thriller, Romance, Sci-Fi,
                               // Documentary, Horror, Animation, Musical, or a new one
     genre: "Thailand",       // used by the "Genre" filter chips
     language: "Thailand",    // used by the "Language" filter chips
     year: 2026,
     quality: ["HD"],         // any of: "720p", "1080p", "HD", "4K", "8K" (or new ones)
     desc: "One or two sentence synopsis.",
     rt: 0,        showRt: false,
     imdb: 0,      showImdb: false,
     embed: "",                // optional per-title "Watch Now" video URL — paste any YouTube
                                // link shape (watch?v=, youtu.be/, /shorts/, or /embed/), same
                                // as `trailer` below; blank uses the default demo video
     trailer: "",               // optional per-title trailer URL (YouTube watch/share/shorts links all work); blank hides the trailer button
     download: "",              // optional per-title "Download" link (any URL); blank keeps
                                 // the Download button as a toast-only placeholder
     seasons: [],               // TV shows only — leave [] to hide the Episodes section entirely.
                                 // Fill in like this to show it:
                                 // seasons: [
                                 //   {
                                 //     season: 1,
                                 //     episodes: [
                                 //       { title: "Episode Title" },
                                 //     ],
                                 //   },
                                 // ],
   },
   -----------------------------------------------------------
*/
const TITLES = [

  { title: "Gohan", poster: "gohan.jpg", type: "movie", category: "Drama", genre: "Thailand", language: "Thailand", year: 2026, quality: ["HD"], desc: "The bonds between humans and animals following a stray dog named Gohan as it moves through life with temporary owners over a decade, through good times and bad times, joy and sorrow, hellos and goodbyes.", rt: 91, showRt: false, imdb: 7.6, showImdb: true, trailer: "https://www.youtube.com/watch?v=upaQ2e1KHKU", embed: "https://bysejikuar.com/e/ozplbhtpfyuc/gohan-2026-1080p-nf-web-dl-ddp5-1-h-264-hbo" ,download: "https://bysejikuar.com/d/ozplbhtpfyuc/gohan-2026-1080p-nf-web-dl-ddp5-1-h-264-hbo" },
  { title: "Hadestown: The Musical",poster: "hadestown.jpg", type: "movie", category: "Drama", genre: "English", language: "English", year: 2026, quality: ["HD"], desc: "A musical juxtaposition of the Orpheus/Eurydice and Hades/Persephone myths that examines the way real life can impact our quest for a perfect world.", rt: 78, showRt: false, imdb: 8.6, showImdb: true , trailer: "https://youtu.be/76Q5TWHslOE?si=vjVPy6IORUOT-QQe", embed: "https://bysejikuar.com/e/f1mxambqaxtg/hadestown-the-musical-2026-1080p-webrip-10bit-ddp5-1-x265-neonoir" ,download: "https://bysejikuar.com/d/f1mxambqaxtg/hadestown-the-musical-2026-1080p-webrip-10bit-ddp5-1-x265-neonoir" },
  { title: "Batman: Knightfall - Part 1: Knightfall",poster: "BatmanKnightfall.jpg", type: "movie", category: "Action -Adventure", genre: "English", language: "English", year: 2026, quality: ["HD"], desc: "When the mysterious behemoth known only as Bane frees Batman's entire rogue's gallery from Arkham Asylum, the Caped Crusader is pushed to his mental and physical breaking point.", rt: 78, showRt: false, imdb: 8.0, showImdb: true , trailer: "https://youtu.be/90HAqMk7qv0?si=vR2rWqMp_RkxAhzI", embed: "https://bysejikuar.com/e/242lwnsbl5mt/batman-knightfall-part-1-knightfall-2026-1080p-webrip-10bit-ddp5-1-x265-neonoir" ,download: "https://bysejikuar.com/d/242lwnsbl5mt/batman-knightfall-part-1-knightfall-2026-1080p-webrip-10bit-ddp5-1-x265-neonoir" },
  { title: "Doraemon: Nobita and the New Castle of the Undersea Devil",poster: "doraemon2026.jpg", type: "movie", category: "Action-Adventure", language: "Japanese", year: 2026, quality: ["HD"], desc: "Nobita and friends finds a secret underwater castle packed with mysteries and riches. With Doraemon's high-tech gadgets, they dive into an ocean adventure mixing humor, teamwork, and imagination in a breathtaking aquatic world.", rt: 78, showRt: false, imdb: 6.3, showImdb: true , trailer: "https://youtu.be/dvU9Mv1cfAw?si=HdmP1YNlINc9f8kS", embed: "https://bysejikuar.com/e/ioxu0bs004gw/doraemon-the-movie-new-nobita-and-the-castle-of-the-undersea-devil-2026-1080p-blu-ray-aac-5-1-x264-n3x" ,download: "https://bysejikuar.com/d/ioxu0bs004gw/doraemon-the-movie-new-nobita-and-the-castle-of-the-undersea-devil-2026-1080p-blu-ray-aac-5-1-x264-n3x" },
  { title: "Obsession",poster: "obsession.jpg", type: "movie", category: "Horror", genre: "English", language: "English", year: 2026, quality: ["HD"], desc: "After breaking the mysterious One Wish Willow to win his crush's heart, a hopeless romantic finds himself getting exactly what he asked for but soon discovers that some desires come at a dark, sinister price.", trailer: "https://youtu.be/gMC8kkwbIQQ?si=gXwcj7WCR0pCSEGw", embed: "https://bysejikuar.com/e/fs2x3uqg49z6/obsession-2025-720p-webrip-aac-yts-gg-yts-bz" ,download: "https://bysejikuar.com/d/fs2x3uqg49z6/obsession-2025-720p-webrip-aac-yts-gg-yts-bz" },
  { title: "Backrooms",poster: "backrooms.jpg", type: "movie", category: "Horror", genre: "English", language: "English", year: 2026, quality: ["HD"], desc: "After a therapist's patient disappears into a dimension beyond reality, she must venture into the unknown to save him.", trailer: "https://youtu.be/0HjdiohVOik?si=u9T7JQvQgJQL0ZuI", embed: "https://bysejikuar.com/e/mo2sv8kbhh42/backrooms-2026-1080p-hdrip-hevc-x265-bone" ,download: "https://bysejikuar.com/d/mo2sv8kbhh42/backrooms-2026-1080p-hdrip-hevc-x265-bone" },  
  { title: "Nightborn",poster: "nightborn.jpg", type: "movie", category: "Horror", genre: "English", language: "English", year: 2026, quality: ["HD"], desc: "In Finnish forest, Saga and her husband Jon embark on a new chapter as parents. But Saga's joy is overshadowed by a chilling suspicion about their newborn, unbeknownst to Jon, causing a rift as she alone grapples with the disturbing truth", trailer: "https://youtu.be/dWePsu_Kd9c?si=O1zl0g-McgQOx1_l", embed: "https://bysejikuar.com/e/mbzm2fuvnrdl/nightborn-2026-1080p-web-dl-hevc-x265-5-1-bone" ,download: "https://bysejikuar.com/d/mbzm2fuvnrdl/nightborn-2026-1080p-web-dl-hevc-x265-5-1-bone" },
  { title: "Heretic",poster: "heretic.jpg", type: "movie", category: "Horror", genre: "English", language: "English", year: 2024, quality: ["HD"], desc: "Two young Mormon women are drawn into a game of cat-and-mouse in the house of a strange man.", trailer: "https://youtu.be/O9i2vmFhSSY?si=5YcfZydYpNMJYGiq", embed: "https://bysejikuar.com/e/fzv8kj1xn1qf/heretic-2024-1080p-10bit-webrip-6ch-x265-hevc-psa" ,download: "https://bysejikuar.com/d/fzv8kj1xn1qf/heretic-2024-1080p-10bit-webrip-6ch-x265-hevc-psa" },
  { title: "Dogtooth",poster: "dogtooth.jpg", type: "movie", category: "Horror", genre: "English", language: "Greece", year: 2009, quality: ["HD"], desc: "A controlling, manipulative father locks his three adult offspring in a state of perpetual childhood by keeping them prisoner within the sprawling family compound.", trailer: "https://youtu.be/YJe4eZ9l5KY?si=0tpRRpJa3v8aMwEb", embed: "https://bysejikuar.com/e/50z4sruwirtv/dogtooth-2009-720p-bluray-x264-yts-am" ,download: "https://bysejikuar.com/d/50z4sruwirtv/dogtooth-2009-720p-bluray-x264-yts-am" },
  { title: "Michael",poster: "michael.jpg", type: "movie", category: "Biography", language: "English", year: 2026, quality: ["HD"], desc: "The early life of musician Michael Jackson, from the discovery of his talent as the lead of the Jackson Five to the artist whose creative ambition fueled a pursuit to become the biggest entertainer in the world", trailer: "https://youtu.be/3zOLzsbOleM?si=TU8DNPk1KH5Bsaa6", embed: "https://bysejikuar.com/e/998urygk8u1e/michael-2026-720p-webrip-aac-yts-bz" ,download: "https://bysejikuar.com/d/998urygk8u1e/michael-2026-720p-webrip-aac-yts-bz" },
  { title: "Project Hail Mary",poster: "hailmary.jpg", type: "movie", category: "Scifi", language: "English", year: 2026, quality: ["HD"], desc: "A science teacher wakes up alone on a spaceship. As his memory returns, he uncovers a mission to stop a mysterious substance killing Earth's sun, and realizes that an unexpected friendship may be the key.", trailer: "https://youtu.be/m08TxIsFTRI?si=rdADvfSheKDxZxyo", embed: "https://bysejikuar.com/e/301dp8bj9p64/project-hail-mary-2026-imax-720p-webrip-aac-yts-bz" ,download: "https://bysejikuar.com/d/301dp8bj9p64/project-hail-mary-2026-imax-720p-webrip-aac-yts-bz" },
  { title: "Weapons",poster: "weapons.jpg", type: "movie", category: "Folk Horror", language: "English", year: 2026, quality: ["HD"], desc: "When all but one child from the same class mysteriously vanish on the same night at exactly the same time, a community is left questioning who or what is behind their disappearance.", trailer: "https://youtu.be/OpThntO9ixc?si=nu-nji-cevFCSDl6", embed: "https://bysejikuar.com/e/fv0ul56u8lia/weapons-2025-720p-webrip-aac-yts-mx" ,download: "https://bysejikuar.com/d/fv0ul56u8lia/weapons-2025-720p-webrip-aac-yts-mx" },
  { title: "Barbarian",poster: "barbarian.jpg", type: "movie", category: "Thriller", language: "English", year: 2022, quality: ["HD"], desc: "A woman staying at an Airbnb discovers that the house she has rented is not what it seems.", trailer: "https://youtu.be/Dr89pmKrqkI?si=dkjCrP5nLuLLUDC4", embed: "https://bysejikuar.com/e/ws0rjdel7p5f/barbarian-2022-720p-webrip-aac-yts-mx" ,download: "https://bysejikuar.com/d/ws0rjdel7p5f/barbarian-2022-720p-webrip-aac-yts-mx" },
  { title: "Rental Family",poster: "rentalfamily.jpg", type: "movie", category: "Family-Drama", language: "English", year: 2025, quality: ["HD"], desc: "An American actor in Tokyo struggling to find purpose lands an unusual gig: working for a Japanese rental family agency, playing stand-in roles for strangers. He rediscovers purpose, belonging, and the beauty of human connection.", trailer: "https://youtu.be/n0pqP6ClcE8?si=HDvuZW_HvFStauNl", embed: "https://bysejikuar.com/e/ilz0ks1vz6sn/rental-family-2025-720p-webrip-aac-yts-bz" ,download: "https://bysejikuar.com/d/ilz0ks1vz6sn/rental-family-2025-720p-webrip-aac-yts-bz" },
  { title: "The Whale",poster: "thewhale.jpg", type: "movie", category: "Drama", language: "English", year: 2022, quality: ["HD"], desc: "A reclusive, morbidly obese English teacher attempts to reconnect with his estranged teenage daughter.", trailer: "https://youtu.be/D30r0CwtIKc?si=CZjFmhvXFUo1QBKx" , embed: "https://bysejikuar.com/e/xif4x1nc4oes/the-whale-2022-1080p-webrip-1400mb-dd5-1-x264-galaxyrg" ,download: "https://bysejikuar.com/d/xif4x1nc4oes/the-whale-2022-1080p-webrip-1400mb-dd5-1-x264-galaxyrg"},
  { title: "Hachiko",poster: "hachiko.jpg", type: "movie", category: "Drama", language: "English", year: 2023, quality: ["HD"], desc: "The touching story about a loyal dog who waited for the return of his owner in front of a train station for ten years, even after his owner's death", trailer: "https://youtu.be/QrPyiBGD9nc?si=fKd1ZGBLAeQGk1Lz", embed: "https://bysejikuar.com/e/9al4tj8c7l4v/hachiko-2023-720p-bluray-aac-yts-mx" ,download: "https://bysejikuar.com/d/9al4tj8c7l4v/hachiko-2023-720p-bluray-aac-yts-mx" },
  { title: "Grave of the Fireflies",poster: "graveoffireflies.jpg", type: "movie", category: "Drama", language: "Japanese", year: 1988, quality: ["HD"], desc: "A young boy and his little sister struggle to survive in Japan during World War II.", trailer: "https://youtu.be/4vPeTSRd580?si=rWJvQleup7PoR9PI", embed: "https://bysejikuar.com/e/wl2sdl01eb62/grave-of-the-fireflies-1988-720p-bluray-x264-yts-am" ,download: "https://bysejikuar.com/d/wl2sdl01eb62/grave-of-the-fireflies-1988-720p-bluray-x264-yts-am" },
  { title: "Carolina Caroline",poster: "carolina.jpg", type: "movie", category: "Crime", language: "English", year: 2025, quality: ["HD"], desc: "A young woman joins a charming con man on the run, leaving a trail of crime and passion as they hustle through the Southeast in search of her estranged mother.", trailer: "https://youtu.be/fNdC6SJ-TxY?si=U9q-jN8IA3pBh7de", embed: "https://bysejikuar.com/e/3wqspykikbvk/carolina-caroline-2025-720p-webrip-aac-yts-gg-yts-bz" ,download: "https://bysejikuar.com/d/3wqspykikbvk/carolina-caroline-2025-720p-webrip-aac-yts-gg-yts-bz" },
  { title: "Over Your Dead Body",poster: "over.jpg", type: "movie", category: "Dark Comedy", language: "English", year: 2026, quality: ["HD"], desc: "A dysfunctional married couple retreats to a secluded cabin to repair their relationship, but each secretly plots to murder the other.", trailer: "https://youtu.be/pGxKTIegUZ4?si=MnGMJPLdhv1nlJyg", embed: "https://bysejikuar.com/e/7ifsahl3e97t/over-your-dead-body-2026-720p-webrip-aac-yts-bz" ,download: "https://bysejikuar.com/d/7ifsahl3e97t/over-your-dead-body-2026-720p-webrip-aac-yts-bz" },
  { title: "Yesterday",poster: "yesterday.jpg", type: "movie", category: "Romantic Comedy", language: "English", year: 2019, quality: ["HD"], desc: "A struggling musician realizes he's the only person on Earth who can remember The Beatles after waking up in an alternate reality where they never existed.", trailer: "https://youtu.be/pGxKTIegUZ4?si=MnGMJPLdhv1nlJyg", embed: "https://youtu.be/6uqvgPm8U4c?si=MQAR5pW7NgwlYkcI" ,download: "https://bysejikuar.com/d/h327zjyqsp4h/yesterday-2019-720p-webrip-800mb-x264-galaxyrg"},
  { title: "Ladies First",poster: "ladysfirst.jpg", type: "movie", category: "Satire Comedy", language: "English", year: 2026, quality: ["HD"], desc: "A male chauvinist is transported to a matriarchal society, facing challenges from a formidable female version of himself.", trailer: "https://youtu.be/oG8D_A1vTfQ?si=ckJY_7-Ff3eQFdQF", embed: "https://bysejikuar.com/e/axqzmhkxvc6j/ladies-first-2026-720p-webrip-aac-yts-bz" ,download: "https://bysejikuar.com/d/axqzmhkxvc6j/ladies-first-2026-720p-webrip-aac-yts-bz" },
  { title: "Eternity",poster: "eternity.jpg", type: "movie", category: "Romantic Comedy", language: "English", year: 2026, quality: ["HD"], desc: "In an afterlife where souls have one week to decide where to spend eternity, Joan is faced with the impossible choice between the man she spent her life with and her first love, who died young and has waited decades for her to arrive.", trailer: "https://youtu.be/irXTps1REHU?si=OYPZU4gEIFisdPej", embed: "https://bysejikuar.com/e/6oues0hq6qtt/eternity-2025-720p-webrip-aac-yts-lt" ,download: "https://bysejikuar.com/d/6oues0hq6qtt/eternity-2025-720p-webrip-aac-yts-lt" },
  { title: "Defending Your Life",poster: "defendingyourlife.jpg", type: "movie", category: "Satire Comedy", language: "English", year: 1991, quality: ["HD"], desc: "In an afterlife way-station resembling a major city, the lives of the recently deceased are examined in a court-like setting", trailer: "https://youtu.be/x1FhrhoudSE?si=hweOcgf3gngmrVLB", embed: "https://bysejikuar.com/e/de9hig7whjuv/defending-your-life-1991-restored-bdrip-x264-gazer" ,download: "https://bysejikuar.com/d/de9hig7whjuv/defending-your-life-1991-restored-bdrip-x264-gazer" },
  { title: "One Battle After Another",poster: "onebattle.jpg", type: "movie", category: "Political-Thriller", language: "English", year: 2025, quality: ["HD"], desc: "When their enemy resurfaces after 16 years, a group of ex-revolutionaries reunite to rescue the daughter of one of their own.", trailer: "https://youtu.be/feOQFKv2Lw4?si=MrYD6c0RR7-pTdWq", embed: "https://bysejikuar.com/e/tqtppg0so096/one-battle-after-another-2025-720p-webrip-aac-yts-mx" ,download: "https://bysejikuar.com/d/tqtppg0so096/one-battle-after-another-2025-720p-webrip-aac-yts-mx" },
  
  

  { title: "Avatar: The Last Airbender", poster: "airbendertv.jpg", type: "tv", category: "Supernatural-Fantasy", language: "English", year: 2024, quality: ["HD"], desc: "A young boy known as the Avatar must master the four elemental powers to save the world, and fight against an enemy bent on stopping him.", trailer: "https://youtu.be/M_Las484swM?si=G7eZzlb4RoJhb4FZ",
      seasons: [
      {
        season: 1,
        episodes: [
          { title: "Aang", url: "https://bysejikuar.com/e/59uh92tp42pf/avatar-the-last-airbender-s01e01-aang" },
          { title: "Warriors" , url: "https://bysejikuar.com/e/h1zlez6mdj73/avatar-the-last-airbender-s01e02-warriors"},
          { title: "Omashu", url: "https://bysejikuar.com/e/c6d5wshl8ent/avatar-the-last-airbender-s01e03-omashu" },
          { title: "Into the Dark", url: "https://bysejikuar.com/e/zrmhgm7mbdu4/avatar-the-last-airbender-s01e04-into-the-dark" },
          { title: "Spirited Away", url: "https://bysejikuar.com/e/texw3k7gvgbd/avatar-the-last-airbender-s01e05-spirited-away" },
          { title: "Masks", url: "https://bysejikuar.com/e/8njhm2zi31r2/avatar-the-last-airbender-s01e06-masks" },
          { title: "The North", url: "https://bysejikuar.com/e/98ocuzlqbu54/avatar-the-last-airbender-s01e07-the-north" },
          { title: "Legends" , url: "https://bysejikuar.com/e/opkejpkiq5ii/avatar-the-last-airbender-s01e08-legends"},
        ],
      },
      {
        season: 2,
        episodes: [
          { title: "Somewhere Safe", url: "https://bysejikuar.com/e/cr5gkuzewgsk/avatar-the-last-airbender-s02e01-somewhere-safe" },
          { title: "A Fight, Once Begun" , url: "https://bysejikuar.com/e/5ia3y4i7vubf/avatar-the-last-airbender-s02e02-a-fight-once-begun"},
          { title: "City of Walls and Secrets", url: "https://bysejikuar.com/e/s7nsfjhfx36h/avatar-the-last-airbender-s02e03-city-of-walls-and-secrets" },
          { title: "The Water Falls, the Stones Emerge", url: "https://bysejikuar.com/e/rcl6dsj04s1q/avatar-the-last-airbender-s02e04-the-water-falls-the-stones-emerge" },
          { title: "Ten Thousand Things", url: "https://bysejikuar.com/e/fpooh3v3szd6/avatar-the-last-airbender-s02e05-ten-thousand-things" },
          { title: "The Parable of the Two Dragons", url: "https://bysejikuar.com/e/0nxaixd1op53/avatar-the-last-airbender-s02e06-the-parable-of-the-two-dragons" },
          { title: "Something Broken", url: "https://bysejikuar.com/e/so955gy7aqq1/avatar-the-last-airbender-s02e07-something-broken" },
        ],
      },
    ],
  },
  { title: "A Knight of the Seven Kingdoms",poster: "aknightofsevenkingdom.jpg", type: "tv", category: "Dark Fantasy", language: "English", year: 2026, quality: ["HD"], desc: "A century before the events of Game of Thrones, Ser Duncan the Tall, and his squire, Egg, wander through Westeros while the Targaryen dynasty rule the Iron Throne. Great destinies and enemies await the incomparable friends.", trailer: "https://youtu.be/sItUCKJQLTU?si=hxc018hoWaGT0gTZ" ,
      seasons: [
      { 
        season: 1,
        episodes: [
          { title: "The Hedge Knight" , url: "https://bysejikuar.com/e/74gwdhhi2qbl/a-knight-of-the-seven-kingdoms-s01e01-the-hedge-knight"},
          { title: "Hard Salt Beef", url: "https://bysejikuar.com/e/w03ixt8v6btj/a-knight-of-the-seven-kingdoms-s01e02-hard-salt-beef" },
          { title: "The Squire" , url: "https://bysejikuar.com/e/r6j9mhmcj404/a-knight-of-the-seven-kingdoms-s01e03-the-squire"},
          { title: "Seven", url: "https://bysejikuar.com/e/tbdcrtvo5hhk/a-knight-of-the-seven-kingdoms-s01e04-seven" },
          { title: "In the Name of the Mother", url: "https://bysejikuar.com/e/83vdhg9ejoi2/a-knight-of-the-seven-kingdoms-s01e05-in-the-name-of-the-mother" },
          { title: "The Morrow", url: "https://bysejikuar.com/e/d07xc4jzvgaa/a-knight-of-the-seven-kingdoms-s01e06-the-morrow" },
        ],
      },
    ],
  },

  
  


  // Add your 30+ new titles below this line, following the TEMPLATE above.
];

function slugify(title) {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

/* ---------------------------------------------------------
   VISITOR ANALYTICS — reads what the browser is willing to tell
   us about itself (no libraries needed). Used to log each visit
   to Firestore so we can see real usage across devices.
--------------------------------------------------------- */
function getDeviceType() {
  const ua = navigator.userAgent || "";
  const isTablet = /iPad|Android(?!.*Mobile)|Tablet/i.test(ua);
  if (isTablet) return "tablet";
  const isMobile = /Mobi|Android|iPhone|iPod|IEMobile|BlackBerry|Opera Mini/i.test(ua);
  if (isMobile) return "mobile";
  return "desktop";
}

function getBrowserName() {
  const ua = navigator.userAgent || "";
  if (/Edg\//.test(ua)) return "Edge";
  if (/OPR\//.test(ua) || /Opera/.test(ua)) return "Opera";
  if (/Chrome\//.test(ua) && !/Chromium/.test(ua)) return "Chrome";
  if (/Firefox\//.test(ua)) return "Firefox";
  if (/Safari\//.test(ua) && /Version\//.test(ua)) return "Safari";
  return "Unknown";
}

function getOSName() {
  const ua = navigator.userAgent || "";
  const platform = navigator.platform || "";
  if (/iPhone|iPad|iPod/.test(ua)) return "iOS";
  if (/Android/.test(ua)) return "Android";
  if (/Win/.test(platform) || /Windows/.test(ua)) return "Windows";
  if (/Mac/.test(platform) && !/iPhone|iPad|iPod/.test(ua)) return "macOS";
  if (/Linux/.test(platform)) return "Linux";
  return "Unknown";
}

function getScreenSize() {
  return `${window.screen.width}x${window.screen.height}`;
}

// Unlisted YouTube demo video — swap this per-title later via each item's `embed` field
const DEFAULT_EMBED = "https://bysejikuar.com/e/0cw8ajyvlk0x";

// Accepts whatever YouTube link shape you paste in (watch?v=, youtu.be/, /shorts/,
// or an already-embeddable /embed/ link) and normalizes it to an embeddable URL.
// Non-YouTube links are passed through untouched, so any host works for `trailer`
// just like it already does for `embed`.
function toYouTubeEmbed(url) {
  if (!url || !url.trim()) return "";
  try {
    const u = new URL(url.trim());
    if (u.hostname.includes("youtu.be")) {
      return `https://www.youtube.com/embed/${u.pathname.slice(1)}`;
    }
    if (u.hostname.includes("youtube.com")) {
      if (u.pathname === "/watch") {
        const id = u.searchParams.get("v");
        return id ? `https://www.youtube.com/embed/${id}` : url.trim();
      }
      if (u.pathname.startsWith("/shorts/")) {
        return `https://www.youtube.com/embed/${u.pathname.split("/")[2]}`;
      }
      // already /embed/... — leave as is
    }
    return url.trim();
  } catch {
    return url.trim();
  }
}

const CATALOG = TITLES.map((t, i) => ({
  id: i + 1,
  title: t.title,
  type: t.type,
  category: t.category,
  genre: t.genre,
  language: t.language,
  year: t.year,
  quality: t.quality,
  rt: t.rt ?? 0,
  showRt: t.showRt ?? false,
  desc: t.desc,
  imdb: t.imdb ?? 0,
  showImdb: t.showImdb ?? false,
  gradient: grad(i),
  icon: CATEGORY_ICON[t.category] || "\ud83c\udfa5",
  // Easy poster: use `poster` verbatim if given, otherwise fall back
  // to auto-slugging the title (so old entries keep working).
  poster: `${import.meta.env.BASE_URL}posters/${t.poster && t.poster.trim() ? t.poster.trim() : slugify(t.title) + ".jpg"}`,
  embed: t.embed && t.embed.trim() ? toYouTubeEmbed(t.embed) : DEFAULT_EMBED,
  trailer: toYouTubeEmbed(t.trailer),
  download: t.download && t.download.trim() ? t.download.trim() : "",
  seasons: t.seasons || [],
  reviews: t.reviews || [
    { site: "aeyenah.com", url: "https://aeyenah.com/2026/07/01/filmrecensie-gohan/" },
    { site: "The Reel Notice", url: "#" },
    { site: "CineDispatch", url: "#" },
  ],
}));

const WEEKLY = [1, 4, 9, 3, 14, 19, 6, 17].map((id) => CATALOG.find((c) => c.id === id)).filter(Boolean);

/* ---------------------------------------------------------
   FOMO + LIVE CHAT MOCK DATA
--------------------------------------------------------- */
const FAKE_NAMES = [
  "Marielle", "Jhun", "Soo-jin", "Kenji", "Amara", "Théo", "Divine", "Carlo",
  "Yuki", "Pao", "Léa", "Bogart", "Hana", "Cristina", "Miggy", "Noor",
];

function randomFrom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

// A much bigger, categorized bank of things a "real" Pinoy viewer might say,
// so both the ambient background chatter AND replies to real users'
// messages feel varied instead of the same few lines repeating. Each entry
// is a function of the relevant title so it can reference it naturally.
// Mostly Taglish (natural sa mga Pinoy chatroom) with some witty one-liners
// and jokes mixed in.
//
// NOTE: a real AI-powered reply (Gemini via a Cloud Function) is already
// built and sitting in /functions/index.js, ready to wire back in once
// the Firebase project is on the Blaze plan — see requestAiReply below
// for where that would plug back in.
const CHATTER_BANK = {
  // Type-agnostic lines — safe for both movies AND TV shows (no "episode"
  // talk here, since that only makes sense for a show).
  generic: [
    (t) => `sino pa nanonood ng ${t} ngayon`,
    (t) => `panoorin ko na naman ${t} for the 3rd time lol`,
    (t) => `kakastart ko lang ng ${t}, huwag niyo ako i-spoiler`,
    (t) => `may pareho ba kayo ng peg ng ${t}? pa-recommend`,
    (t) => `${t} nasa isip ko buong araw, ano ba 'to`,
    (t) => `di na ko natulog kagabi dahil sa ${t}, sulit naman`,
    (t) => `sino umiyak dun sa ${t}? ako umiyak`,
    (t) => `${t} kulang sa hype eh, ang galing nito`,
    (t) => `yung pacing ng ${t}, ang husay talaga`,
    (t) => `okay pero yung soundtrack ng ${t}?? sobrang ganda`,
    (t) => `sinira ng ${t} buong week ko (sa magandang paraan)`,
    (t) => `may rec ba kayo pagkatapos ng ${t}`,
    (t) => `hindi ko in-expect na ganito pala ang ${t}`,
    (t) => `bakit walang nagsasalita tungkol sa ${t}, ang galing nito ah`,
    (t) => `grabe, sobrang tagal kong hinanap ang ${t}, salamat BetamaxTV`,
    (t) => `libre pa lang 'to? sana all, ${t} sulit na sulit`,
  ],
  // Extra lines that specifically talk about episodes/seasons — only ever
  // mixed in when the title being discussed is actually a TV show.
  generic_tv: [
    (t) => `three episodes pa lang ako sa ${t}, hooked na ko`,
    (t) => `ilang season na ba ang ${t}? gusto ko lahat mabinge`,
    (t) => `natapos ko na lahat ng episode ng ${t}, di ako makapaghintay ng bagong season`,
    (t) => `bingeable talaga ang ${t}, hindi ko kaya mag-isang episode lang`,
  ],
  // Extra lines that reference "runtime"/"eksena" style movie talk — mixed
  // in only when the title is a movie.
  generic_movie: [
    (t) => `natapos ko na si ${t}, sulit ang two hours`,
    (t) => `sobrang bilis lumipas ng oras kay ${t}, ganun kaganda`,
    (t) => `re-watch mode na naman ako ng ${t}, hindi ako nasasawa`,
  ],
  greeting: [
    () => "hello mga chat 👋",
    () => "kamusta chat, ano panoorin natin",
    () => "magandang gabi mga kapatid, ano na",
    () => "bagong join lang, ano bang uso dito",
    () => "hii, meron bang magandang panood ngayon",
  ],
  agree: [
    (t) => `totoo, sobrang underrated ng ${t}`,
    (t) => `tama ka jan, kulang lang sa marketing ang ${t}`,
    () => "grabe sobrang totoo nyan",
    () => "same energy, ako din",
    () => "yan na yan, gets na gets ko",
    (t) => `${t} gang undefeated`,
  ],
  question_reply: [
    (t) => `try mo ${t}, solid din yan`,
    (t) => `depende sa mood mo eh, pero panoorin mo ${t} next`,
    () => "depende talaga sa peg mo eh",
    () => "sandali lang, iisipin ko",
    (t) => `${t} sagot sa uhaw ko sa magandang panood`,
  ],
  spoiler_warning: [
    () => "huwag spoiler pls, kakastart ko lang 😭",
    () => "shh wag mo sabihin, di ko pa dun",
    () => "spoiler tag mo naman next time",
    () => "tinatakpan ko mata ko ngayon",
  ],
  praise_reply: [
    (t) => `tama ka, ${t} understood the assignment talaga`,
    () => "fr fr, sobrang tama",
    () => "underrated take pero sang-ayon ako",
    () => "tama ka dyan, galing mo mag-isip",
  ],
  // Witty one-liners and jokes riffing on the movie/show — the kind of
  // banter you'd see in an actual Pinoy livestream chat.
  joke: [
    (t) => `sabi ni Mama wag daw manood ng ${t} nang mag-isa... late na 😂`,
    (t) => `${t} tapos may pasok pa ko bukas, sino may kasalanan dito`,
    (t) => `nag-log in lang ako para libangin sarili, umiyak pa rin sa ${t}`,
    (t) => `${t} plot twist level: nanay mo pag may tanong`,
    (t) => `wag niyo akong tawagin habang nanonood ako ng ${t}, may kaso`,
    (t) => `libre 'to? akala ko pirated lang pwede ganito ka-sulit`,
    (t) => `${t} ang tapang mag-drop ng ganyang eksena, hindi ko na kaya puso ko`,
    (t) => `ilang beses ko na binalikan ang ${t}, di ko na rin bilang`,
    (t) => `si Kuya nanonood din pala ng ${t}, ang bilis kumalat, sikat na sikat na 'to`,
    (t) => `${t} tapos yung crush ko chat-mate ko, panalo talaga tonight`,
  ],
  // Ambient "feedback" about the BetamaxTV platform itself — mixed in
  // occasionally so the chat also feels like real user feedback, not just
  // movie talk.
  feedback: [
    () => "ang bilis ng loading dito sa BetamaxTV grabe",
    () => "sana lagyan din ng dark mode toggle, pero solid na 'to",
    () => "walang ads?? sulit na sulit ang app na 'to",
    () => "yung request feature, ginamit ko na, sana madagdagan yung hiling ko",
    () => "mas mabilis pa 'to kaysa sa datos ko sa bahay HAHA",
  ],
};

// Genre-specific call-outs, keyed by a normalized version of each title's
// `category` field. Written like an actual Pinoy viewer hyping up (or
// warning about) a title to their "Sis/Pre/Mars" in chat.
const GENRE_CHATTER = {
  horror: [
    (t) => `${t} ay sobrang nakakatakot, subukan niyo panoorin! mga Sis!`,
    (t) => `wag niyo panoorin ang ${t} ng nag-iisa mga Pre, ayoko ng managot`,
    (t) => `${t} nagpatalon sa akin ng tatlong beses, grabe ka mga Beh`,
    (t) => `di ko na matulugan ang ${t}, ang lala ng peg mga Sis`,
    (t) => `${t} horror movie ng taon 'to, sabi ko na sa inyo mga Kuya`,
  ],
  "folk horror": [
    (t) => `${t} creepy sa paraang tahimik lang, sobrang nakakakaba mga Sis`,
    (t) => `${t} yung tipong horror na di mo alam bakit ka natatakot, ang galing`,
  ],
  drama: [
    (t) => `${t} sobrang lalim ng story, umiyak talaga ako mga Sis`,
    (t) => `wag kayo manood ng ${t} kung nasa low battery kayo sa emosyon mga Beh`,
    (t) => `${t} hugot level 100, sobrang relate ko mga Mars`,
    (t) => `${t} pinaisip ako ng buong gabi, ang bigat ng tema mga Pre`,
  ],
  adventure: [
    (t) => `${t} sobrang saya panoorin, parang kasama mo sa biyahe mga Sis!`,
    (t) => `${t} sulit sa visuals, tara panoorin natin mga Pre`,
    (t) => `${t} feel na feel ko yung adventure, ang galing ng cinematography mga Beh`,
  ],
  comedy: [
    (t) => `${t} nakakatawa grabe, halos mahulog ako sa upuan mga Sis`,
    (t) => `${t} sagot 'to sa stress niyo mga Pre, sobrang saya`,
  ],
  thriller: [
    (t) => `${t} sobrang kaba, di ko mapigilan ang puso ko mga Sis`,
    (t) => `${t} plot twist sasaktan kayo, promise mga Pre`,
  ],
  romance: [
    (t) => `${t} kinilig ako sobra, sino ba may ganyan crush mga Sis`,
    (t) => `${t} sweet grabe, feeling ko may love team tayo dito mga Beh`,
  ],
  "sci-fi": [
    (t) => `${t} ang galing ng concept, parang totoo lang mga Pre`,
    (t) => `${t} nag-iisip ako ng buong araw pagkatapos, deep ang science dito mga Sis`,
  ],
  scifi: [
    (t) => `${t} ang galing ng concept, parang totoo lang mga Pre`,
    (t) => `${t} nag-iisip ako ng buong araw pagkatapos, deep ang science dito mga Sis`,
  ],
  documentary: [
    (t) => `${t} nakakadagdag talaga ng kaalaman, worth the watch mga Sis`,
    (t) => `${t} sobrang informative, dapat panoorin ng lahat mga Pre`,
  ],
  animation: [
    (t) => `${t} ang ganda ng animation, para sa bata at matanda mga Beh`,
    (t) => `${t} nakaka-feel good, ngiti nang ngiti ako mga Sis`,
  ],
  musical: [
    (t) => `${t} ang ganda ng mga kanta, kanta-kanta ako buong panood mga Sis`,
    (t) => `${t} chills ang production number, panalo mga Pre`,
  ],
  crime: [
    (t) => `${t} sobrang nakaka-engganyo, parang totoong case lang mga Sis`,
    (t) => `${t} di ko mahulaan sino salarin, galing ng writing mga Pre`,
  ],
  "dark comedy": [
    (t) => `${t} nakakatawa pero nakaka-guilty tumawa, ganun ka-dark mga Sis`,
    (t) => `${t} sobrang witty, hindi mo alam kung tatawa o mag-iisip ka mga Pre`,
  ],
  "dark fantasy": [
    (t) => `${t} ang lalim ng mundo nito, sobrang immersive mga Sis`,
    (t) => `${t} may kadiliman pero ang ganda ng storytelling mga Beh`,
  ],
  "romantic comedy": [
    (t) => `${t} nakakakilig at nakakatawa sabay, panalo combo mga Sis`,
    (t) => `${t} feel good movie 'to, pang-stress reliever mga Beh`,
  ],
  "satire comedy": [
    (t) => `${t} sobrang tapang mag-comment sa lipunan, witty na witty mga Pre`,
    (t) => `${t} nakakatawa pero may punchline sa totoong buhay mga Sis`,
  ],
};

// Turns a title's raw `category` field ("Sci-Fi", "Folk Horror", etc.)
// into a lowercase key that matches GENRE_CHATTER above.
function normalizeGenreKey(category) {
  return (category || "").trim().toLowerCase();
}

// Very lightweight keyword sniffing so replies at least feel like they're
// responding to what the user actually said, without needing a real model.
function classifyMessage(text) {
  const t = text.toLowerCase();
  if (/\b(hi|hello|hey|sup|yo|kamusta|kumusta)\b/.test(t)) return "greeting";
  if (/spoiler|huwag.*sabihin|wag.*sabihin/.test(t)) return "spoiler_warning";
  if (/\b(recommend|suggest|what should|any good|worth it|pa-?rec|ano.*panood|magandang panoorin)\b/.test(t)) return "question_reply";
  if (/\b(love|amazing|so good|best|great|underrated|galing|astig|ang ganda|solid)\b/.test(t)) return "praise_reply";
  if (/\?\s*$/.test(t.trim())) return "question_reply";
  const r = Math.random();
  if (r < 0.15) return "joke";
  if (r < 0.22) return "feedback";
  if (r < 0.4) return "genre";
  return r < 0.7 ? "agree" : "generic";
}

// item is a full catalog entry ({ title, type, category, ... }); we accept
// a bare string too as a fallback so any leftover callers don't break.
function pickChatterLine(category, item) {
  const title = typeof item === "string" ? item : item?.title || "";
  const type = typeof item === "string" ? null : item?.type;
  const genreKey = typeof item === "string" ? null : normalizeGenreKey(item?.category);

  if (category === "genre") {
    const genreBank = genreKey && GENRE_CHATTER[genreKey];
    if (genreBank) return randomFrom(genreBank)(title);
    category = "generic"; // no genre-specific lines for this category — fall back
  }

  let bank = CHATTER_BANK[category] || CHATTER_BANK.generic;
  if (category === "generic") {
    if (type === "tv") bank = bank.concat(CHATTER_BANK.generic_tv);
    else if (type === "movie") bank = bank.concat(CHATTER_BANK.generic_movie);
  }
  return randomFrom(bank)(title);
}

function firebaseErrorMessage(err) {
  const code = err && err.code;
  const map = {
    "auth/email-already-in-use": "That email already has an account. Try signing in instead.",
    "auth/invalid-email": "That email address doesn't look right.",
    "auth/weak-password": "Password must be at least 6 characters.",
    "auth/user-not-found": "No account found with that email.",
    "auth/wrong-password": "Incorrect password.",
    "auth/invalid-credential": "Incorrect email or password.",
    "auth/too-many-requests": "Too many attempts. Please wait a moment and try again.",
  };
  return map[code] || "Something went wrong. Please try again.";
}

const CHAT_SEED = [
  { name: "Marielle", text: "Nightborn ay sobrang nakakatakot, subukan niyo panoorin! mga Sis!" },
  { name: "Kenji", text: "umiyak talaga ako sa The Whale, di ko inexpect na ganun kabigat mga Pre" },
  { name: "Pao", text: "sulit ba mag-upgrade sa 4K para sa Iron Orchid" },
  { name: "Léa", text: "welcome sa chat, maging mabait tayo sa isa't isa 🌿" },
];

/* ---------------------------------------------------------
   SMALL UI PIECES
--------------------------------------------------------- */
function Logo({ size = 22 }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
      <div
        style={{
          width: size,
          height: size,
          borderRadius: "9999px 9999px 9999px 2px",
          background: T.mint,
          flexShrink: 0,
        }}
      />
      <span
        style={{
          fontFamily: "'Jost', sans-serif",
          fontWeight: 700,
          fontSize: size * 0.82,
          letterSpacing: "0.02em",
          color: T.paper,
        }}
      >
        BETAMAX<span style={{ color: T.mint }}>TV</span>
      </span>
    </div>
  );
}

function Badge({ children, tone = "outline" }) {
  const styles =
    tone === "solid"
      ? { background: T.mint, color: T.charcoal, border: "1px solid " + T.mint }
      : { background: "transparent", color: T.pale, border: "1px solid " + T.line };
  return (
    <span
      style={{
        ...styles,
        fontFamily: "'Inter', sans-serif",
        fontSize: 11,
        fontWeight: 600,
        letterSpacing: "0.06em",
        textTransform: "uppercase",
        padding: "3px 9px",
        borderRadius: 999,
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </span>
  );
}

function RTBadge({ score }) {
  const good = score >= 60;
  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        background: T.pine,
        border: "1px solid " + T.line,
        borderRadius: 10,
        padding: "8px 14px",
      }}
    >
      <span style={{ fontSize: 20 }}>{good ? "\ud83c\udf45" : "\ud83e\udec2"}</span>
      <div>
        <div
          style={{
            fontFamily: "'Jost', sans-serif",
            fontWeight: 700,
            fontSize: 18,
            color: good ? T.mint : "#E8836B",
            lineHeight: 1,
          }}
        >
          {score}%
        </div>
        <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 10, color: T.pale, letterSpacing: "0.05em" }}>
          ROTTEN TOMATOES
        </div>
      </div>
    </div>
  );
}

function IMDBBadge({ score }) {
  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 10,
        background: T.pine,
        border: "1px solid " + T.line,
        borderRadius: 10,
        padding: "8px 14px",
      }}
    >
      <img
        src={`${import.meta.env.BASE_URL}posters/IMDB_Logo_2016.svg.webp`}
        alt="IMDb"
        style={{ height: 18, objectFit: "contain" }}
      />
      <div>
        <div
          style={{
            fontFamily: "'Jost', sans-serif",
            fontWeight: 700,
            fontSize: 18,
            color: T.paper,
            lineHeight: 1,
          }}
        >
          {score}
          <span style={{ fontSize: 11, color: T.pale, fontWeight: 500 }}>/10</span>
        </div>
        <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 10, color: T.pale, letterSpacing: "0.05em" }}>
          RATING
        </div>
      </div>
    </div>
  );
}

function Poster({ item, onClick, wide }) {
  const [imgFailed, setImgFailed] = useState(false);
  const showImage = item.poster && !imgFailed;
  return (
    <button
      onClick={onClick}
      style={{
        all: "unset",
        cursor: "pointer",
        display: "block",
        width: "100%",
      }}
    >
      <div
        style={{
          background: item.gradient,
          borderRadius: 10,
          aspectRatio: wide ? "16 / 10" : "2 / 3",
          position: "relative",
          overflow: "hidden",
          border: "1px solid " + T.line,
          transition: "transform 0.2s ease",
        }}
        className="rp-poster"
      >
        {showImage ? (
          <img
            src={item.poster}
            alt={item.title}
            onError={() => setImgFailed(true)}
            style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }}
          />
        ) : (
          <div
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: wide ? 36 : 42,
              opacity: 0.85,
              filter: "grayscale(0.15)",
            }}
          >
            {item.icon}
          </div>
        )}
        <div
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            bottom: 0,
            padding: "18px 10px 10px",
            background: "linear-gradient(to top, rgba(11,31,27,0.92), transparent)",
          }}
        >
          <div
            style={{
              fontFamily: "'Jost', sans-serif",
              fontWeight: 600,
              fontSize: 13,
              color: T.paper,
              lineHeight: 1.2,
            }}
          >
            {item.title}
          </div>
          <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 10.5, color: T.pale, marginTop: 3 }}>
            {item.year} &middot; {item.type === "tv" ? "TV Show" : "Movie"}
          </div>
        </div>
      </div>
    </button>
  );
}

/* ---------------------------------------------------------
   HERO — auto-sliding weekly popular filmstrip
--------------------------------------------------------- */
function Hero({ onOpen }) {
  const strip = [...WEEKLY, ...WEEKLY];
  return (
    <section style={{ padding: "56px 0 40px", borderBottom: "1px solid " + T.line }}>
      <div style={{ maxWidth: 1180, margin: "0 auto", padding: "0 24px" }}>
        <h1
          style={{
            fontFamily: "'Jost', sans-serif",
            fontWeight: 700,
            fontSize: "clamp(32px, 6vw, 68px)",
            color: T.paper,
            lineHeight: 1.05,
            margin: 0,
            maxWidth: 980,
          }}
        >
          Mga sikat na Western films at TV shows, bagong drop kada linggo!
        </h1>
        <p style={{ fontFamily: "'Inter', sans-serif", color: T.pale, fontSize: 17, marginTop: 18, maxWidth: 720 }}>
          Libre ang chill mo dito. Weekend mo, sagot ng BetamaxTV — Ang Bagong Streaming Platform ng Bayan!
        </p>
      </div>

      <div style={{ marginTop: 32, overflow: "hidden" }} className="rp-strip-mask">
        <div className="rp-strip" style={{ display: "flex", gap: 16, width: "max-content" }}>
          {strip.map((item, idx) => (
            <div key={idx} style={{ width: 200, flexShrink: 0 }}>
              <Poster item={item} onClick={() => onOpen(item.id)} />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ---------------------------------------------------------
   EDITORIAL "HEADLINES" SECTION — mirrors the press layout
--------------------------------------------------------- */
function Headlines({ onOpen }) {
  const picks = [CATALOG[16], CATALOG[13], CATALOG[9]];
  return (
    <section style={{ maxWidth: 1180, margin: "0 auto", padding: "48px 24px 8px" }}>
      <h2
        style={{
          fontFamily: "'Jost', sans-serif",
          fontWeight: 700,
          fontSize: 26,
          color: T.paper,
          margin: "0 0 24px",
        }}
      >
        This Week&rsquo;s Headlines
      </h2>
      {picks.map((item, i) => (
        <div key={item.id}>
          <div style={{ display: "flex", gap: 20, alignItems: "flex-start", padding: "20px 0" }} className="rp-headline-row">
            <div style={{ width: 150, flexShrink: 0 }}>
              <Poster item={item} onClick={() => onOpen(item.id)} wide />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <button
                onClick={() => onOpen(item.id)}
                style={{
                  all: "unset",
                  cursor: "pointer",
                  fontFamily: "'Jost', sans-serif",
                  fontWeight: 600,
                  fontSize: 19,
                  color: T.mint,
                  lineHeight: 1.25,
                }}
              >
                {item.title}
              </button>
              <p style={{ fontFamily: "'Inter', sans-serif", color: T.pale, fontSize: 13.5, margin: "8px 0 14px", maxWidth: 560 }}>
                {item.desc}
              </p>
              <button
                onClick={() => onOpen(item.id)}
                style={{
                  all: "unset",
                  cursor: "pointer",
                  fontFamily: "'Inter', sans-serif",
                  fontSize: 11,
                  fontWeight: 700,
                  letterSpacing: "0.08em",
                  color: T.paper,
                  borderBottom: "1px solid " + T.paper,
                  paddingBottom: 2,
                }}
              >
                WATCH NOW
              </button>
            </div>
          </div>
          {i < picks.length - 1 && <div style={{ height: 1, background: T.line }} />}
        </div>
      ))}
    </section>
  );
}

/* ---------------------------------------------------------
   ADVANCED SEARCH MODAL
--------------------------------------------------------- */
function AdvancedSearch({ open, onClose, filters, setFilters, onApply, categoryOptions, genreOptions, languageOptions, qualityOptions }) {
  if (!open) return null;

  function toggle(group, value) {
    setFilters((f) => {
      const set = new Set(f[group]);
      set.has(value) ? set.delete(value) : set.add(value);
      return { ...f, [group]: Array.from(set) };
    });
  }

  const years = [];
  for (let y = 2026; y >= 1900; y--) years.push(y);

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(11,31,27,0.7)",
        zIndex: 60,
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "center",
        padding: "60px 20px",
        overflowY: "auto",
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: T.pine,
          border: "1px solid " + T.line,
          borderRadius: 14,
          maxWidth: 620,
          width: "100%",
          padding: 32,
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 22 }}>
          <h3 style={{ fontFamily: "'Jost', sans-serif", color: T.paper, fontSize: 22, margin: 0, fontWeight: 700 }}>
            Advanced Search
          </h3>
          <button onClick={onClose} style={{ all: "unset", cursor: "pointer", color: T.pale, fontSize: 20 }}>
            &times;
          </button>
        </div>

        <FilterGroup label="Category">
          {categoryOptions.map((c) => (
            <Chip key={c} active={filters.category.includes(c)} onClick={() => toggle("category", c)}>
              {c}
            </Chip>
          ))}
        </FilterGroup>

        <FilterGroup label="Quality">
          {qualityOptions.map((q) => (
            <Chip key={q} active={filters.quality.includes(q)} onClick={() => toggle("quality", q)}>
              {q}
            </Chip>
          ))}
        </FilterGroup>

        <FilterGroup label="Genre">
          {genreOptions.map((g) => (
            <Chip key={g} active={filters.genre.includes(g)} onClick={() => toggle("genre", g)}>
              {g}
            </Chip>
          ))}
        </FilterGroup>

        <FilterGroup label="Language">
          {languageOptions.map((l) => (
            <Chip key={l} active={filters.language.includes(l)} onClick={() => toggle("language", l)}>
              {l}
            </Chip>
          ))}
        </FilterGroup>

        <FilterGroup label="Year">
          <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
            <select
              value={filters.yearFrom}
              onChange={(e) => setFilters((f) => ({ ...f, yearFrom: Number(e.target.value) }))}
              style={selectStyle}
            >
              {years.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
            <span style={{ color: T.pale, fontFamily: "'Inter', sans-serif", fontSize: 13 }}>to</span>
            <select
              value={filters.yearTo}
              onChange={(e) => setFilters((f) => ({ ...f, yearTo: Number(e.target.value) }))}
              style={selectStyle}
            >
              {years.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </div>
        </FilterGroup>

        <div style={{ display: "flex", gap: 10, marginTop: 26 }}>
          <button
            onClick={() =>
              setFilters({ category: [], quality: [], genre: [], language: [], yearFrom: 1900, yearTo: 2026 })
            }
            style={ghostBtn}
          >
            Clear Filters
          </button>
          <button onClick={onApply} style={solidBtn}>
            Apply Filters
          </button>
        </div>
      </div>
    </div>
  );
}

function FilterGroup({ label, children }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", color: T.mint, marginBottom: 10, textTransform: "uppercase" }}>
        {label}
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>{children}</div>
    </div>
  );
}

function Chip({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      style={{
        fontFamily: "'Inter', sans-serif",
        fontSize: 12.5,
        fontWeight: 600,
        padding: "7px 13px",
        borderRadius: 999,
        cursor: "pointer",
        border: "1px solid " + (active ? T.mint : T.line),
        background: active ? T.mint : "transparent",
        color: active ? T.charcoal : T.paper,
      }}
    >
      {children}
    </button>
  );
}

const selectStyle = {
  fontFamily: "'Inter', sans-serif",
  fontSize: 13,
  background: T.ink,
  color: T.paper,
  border: "1px solid " + T.line,
  borderRadius: 8,
  padding: "8px 10px",
};

const solidBtn = {
  fontFamily: "'Inter', sans-serif",
  fontWeight: 700,
  fontSize: 13,
  letterSpacing: "0.03em",
  background: T.mint,
  color: T.charcoal,
  border: "1px solid " + T.mint,
  borderRadius: 8,
  padding: "11px 20px",
  cursor: "pointer",
};

const ghostBtn = {
  fontFamily: "'Inter', sans-serif",
  fontWeight: 700,
  fontSize: 13,
  letterSpacing: "0.03em",
  background: "transparent",
  color: T.paper,
  border: "1px solid " + T.line,
  borderRadius: 8,
  padding: "11px 20px",
  cursor: "pointer",
};

const episodeThStyle = {
  fontFamily: "'Inter', sans-serif",
  fontWeight: 700,
  fontSize: 11.5,
  letterSpacing: "0.04em",
  textTransform: "uppercase",
  color: T.pale,
  textAlign: "left",
  padding: "10px 8px",
};

const episodeTdStyle = {
  fontFamily: "'Inter', sans-serif",
  fontSize: 13.5,
  color: T.pale,
  padding: "10px 8px",
  verticalAlign: "top",
};

/* ---------------------------------------------------------
   SEASON ACCORDION — one collapsible row per season, each
   listing that season's episodes. A TV title only shows this
   at all if it has a non-empty `seasons` array (see TITLES
   template) — movies and season-less TV entries skip it
   entirely, same pattern as `trailer` / `embed`.
--------------------------------------------------------- */
function SeasonAccordion({ season, onWatchEpisode }) {
  const [open, setOpen] = useState(false);
  const episodes = season.episodes || [];

  return (
    <div style={{ border: "1px solid " + T.line, borderRadius: 10, overflow: "hidden", marginBottom: 12 }}>
      <button
        onClick={() => setOpen((o) => !o)}
        style={{
          all: "unset",
          cursor: "pointer",
          width: "100%",
          boxSizing: "border-box",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "16px 18px",
          background: T.pine,
        }}
      >
        <div>
          <div style={{ fontFamily: "'Jost', sans-serif", fontWeight: 700, fontSize: 15.5, color: T.paper }}>
            Season: {season.season}
          </div>
          <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 12.5, color: T.pale, marginTop: 3 }}>
            {episodes.length} Episode{episodes.length === 1 ? "" : "s"}
          </div>
        </div>
        <span
          style={{
            color: T.mint,
            fontSize: 13,
            transform: open ? "rotate(180deg)" : "none",
            transition: "transform 0.15s ease",
          }}
        >
          &#9660;
        </span>
      </button>

      {open && (
        <div style={{ padding: "0 18px 16px", overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 260 }}>
            <thead>
              <tr style={{ borderTop: "1px solid " + T.line }}>
                <th style={{ ...episodeThStyle, width: 36 }}>#</th>
                <th style={episodeThStyle}>Title</th>
              </tr>
            </thead>
            <tbody>
              {episodes.map((ep, i) => (
                <tr key={i} style={{ borderTop: "1px solid " + T.line }}>
                  <td style={episodeTdStyle}>{i + 1}</td>
                  <td style={{ ...episodeTdStyle, color: T.paper, fontWeight: 600 }}>
                    {ep.url ? (
                      <button
                        onClick={() => onWatchEpisode(season, ep)}
                        style={{
                          all: "unset",
                          cursor: "pointer",
                          color: T.mint,
                          textDecoration: "underline",
                          fontFamily: "inherit",
                          fontSize: "inherit",
                          fontWeight: "inherit",
                        }}
                      >
                        {ep.title}
                      </button>
                    ) : (
                      ep.title
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/* ---------------------------------------------------------
   AUTH MODAL — sign up requires the fields in the brief
--------------------------------------------------------- */
function AuthModal({ open, onClose, onAuth, initialMode }) {
  const [mode, setMode] = useState(initialMode || "signup");
  const [form, setForm] = useState({
    username: "",
    password: "",
    email: "",
    favGenre: PROFILE_GENRE_OPTIONS[0],
    favShow: "",
  });
  const [signInForm, setSignInForm] = useState({ email: "", password: "" });
  const [resetEmail, setResetEmail] = useState("");
  const [resetStatus, setResetStatus] = useState(""); // "" | "sent"
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      setMode(initialMode || "signup");
      setError("");
      setResetStatus("");
    }
  }, [open, initialMode]);

  if (!open) return null;

  async function submitSignup(e) {
    e.preventDefault();
    if (!form.username || !form.password || !form.email) {
      setError("Username, password, and email are required.");
      return;
    }
    if (form.password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      const cred = await createUserWithEmailAndPassword(auth, form.email, form.password);
      await updateProfile(cred.user, { displayName: form.username });

      await setDoc(doc(db, "users", cred.user.uid), {
        username: form.username,
        email: form.email,
        favGenre: form.favGenre,
        favShow: form.favShow,
        createdAt: new Date().toISOString(),
      });

      sendEmailVerification(cred.user).catch((err) => {
        console.error("Verification email failed to send:", err);
      });

      fetch("https://formspree.io/f/xkjnnapb", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          username: form.username,
          email: form.email,
          favoriteGenre: form.favGenre,
          favoriteShow: form.favShow,
        }),
      }).catch(() => {});

      onAuth({
        uid: cred.user.uid,
        username: form.username,
        email: form.email,
        favGenre: form.favGenre,
        favShow: form.favShow,
        emailVerified: cred.user.emailVerified,
      });
    } catch (err) {
      setError(firebaseErrorMessage(err));
    }
    setSubmitting(false);
  }

  async function submitSignin(e) {
    e.preventDefault();
    if (!signInForm.email || !signInForm.password) {
      setError("Enter your email and password.");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      const cred = await signInWithEmailAndPassword(auth, signInForm.email, signInForm.password);
      const snap = await getDoc(doc(db, "users", cred.user.uid));
      const profile = snap.exists() ? snap.data() : {};
      onAuth({
        uid: cred.user.uid,
        username: profile.username || cred.user.displayName || signInForm.email,
        email: cred.user.email,
        favGenre: profile.favGenre || PROFILE_GENRE_OPTIONS[0],
        favShow: profile.favShow || "",
        emailVerified: cred.user.emailVerified,
      });
    } catch (err) {
      setError(firebaseErrorMessage(err));
    }
    setSubmitting(false);
  }

  async function submitReset(e) {
    e.preventDefault();
    if (!resetEmail) {
      setError("Enter your email address.");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      await sendPasswordResetEmail(auth, resetEmail);
      setResetStatus("sent");
    } catch (err) {
      setError(firebaseErrorMessage(err));
    }
    setSubmitting(false);
  }

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(11,31,27,0.75)",
        zIndex: 70,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: T.pine,
          border: "1px solid " + T.line,
          borderRadius: 14,
          maxWidth: 420,
          width: "100%",
          padding: 32,
          maxHeight: "88vh",
          overflowY: "auto",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
          <Logo size={18} />
          <button onClick={onClose} style={{ all: "unset", cursor: "pointer", color: T.pale, fontSize: 20 }}>
            &times;
          </button>
        </div>

        {mode !== "forgot" && (
          <div style={{ display: "flex", gap: 18, marginTop: 20, marginBottom: 20, borderBottom: "1px solid " + T.line }}>
            {["signup", "signin"].map((m) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                style={{
                  all: "unset",
                  cursor: "pointer",
                  fontFamily: "'Jost', sans-serif",
                  fontWeight: 600,
                  fontSize: 15,
                  paddingBottom: 10,
                  color: mode === m ? T.mint : T.pale,
                  borderBottom: mode === m ? "2px solid " + T.mint : "2px solid transparent",
                }}
              >
                {m === "signup" ? "Create Account" : "Sign In"}
              </button>
            ))}
          </div>
        )}

        {error && (
          <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 12.5, color: "#E8836B", marginBottom: 14 }}>
            {error}
          </div>
        )}

        {mode === "signup" ? (
          <form onSubmit={submitSignup} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <Field label="Username">
              <input style={inputStyle} value={form.username} onChange={(e) => setForm((f) => ({ ...f, username: e.target.value }))} />
            </Field>
            <Field label="Password">
              <input type="password" style={inputStyle} value={form.password} onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))} />
            </Field>
            <Field label="Email Address">
              <input type="email" style={inputStyle} value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
            </Field>
            <Field label="Favorite Movie Genre">
              <select style={inputStyle} value={form.favGenre} onChange={(e) => setForm((f) => ({ ...f, favGenre: e.target.value }))}>
                {PROFILE_GENRE_OPTIONS.map((g) => (
                  <option key={g} value={g}>
                    {g}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="TV Show You Usually Watch">
              <input style={inputStyle} value={form.favShow} onChange={(e) => setForm((f) => ({ ...f, favShow: e.target.value }))} placeholder="e.g. Paper Lanterns" />
            </Field>
            <button type="submit" disabled={submitting} style={{ ...solidBtn, marginTop: 6, width: "100%", opacity: submitting ? 0.7 : 1 }}>
              {submitting ? "Creating Account..." : "Create Account"}
            </button>
          </form>
        ) : mode === "signin" ? (
          <form onSubmit={submitSignin} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <Field label="Email Address">
              <input type="email" style={inputStyle} value={signInForm.email} onChange={(e) => setSignInForm((f) => ({ ...f, email: e.target.value }))} />
            </Field>
            <Field label="Password">
              <input type="password" style={inputStyle} value={signInForm.password} onChange={(e) => setSignInForm((f) => ({ ...f, password: e.target.value }))} />
            </Field>
            <button
              type="button"
              onClick={() => {
                setResetEmail(signInForm.email);
                setResetStatus("");
                setError("");
                setMode("forgot");
              }}
              style={{
                all: "unset",
                cursor: "pointer",
                alignSelf: "flex-end",
                fontFamily: "'Inter', sans-serif",
                fontSize: 12,
                color: T.mint,
                marginTop: -6,
              }}
            >
              Forgot password?
            </button>
            <button type="submit" disabled={submitting} style={{ ...solidBtn, marginTop: 6, width: "100%", opacity: submitting ? 0.7 : 1 }}>
              {submitting ? "Signing In..." : "Sign In"}
            </button>
          </form>
        ) : (
          <div>
            <button
              onClick={() => {
                setMode("signin");
                setError("");
              }}
              style={{
                all: "unset",
                cursor: "pointer",
                fontFamily: "'Inter', sans-serif",
                fontSize: 12.5,
                color: T.pale,
                marginBottom: 16,
                display: "inline-block",
              }}
            >
              &larr; Back to Sign In
            </button>

            {resetStatus === "sent" ? (
              <p style={{ fontFamily: "'Inter', sans-serif", fontSize: 13.5, color: T.paper, lineHeight: 1.6, margin: 0 }}>
                If an account exists for <strong style={{ color: T.mint }}>{resetEmail}</strong>, a password reset
                link is on its way &mdash; check your inbox (and spam folder).
              </p>
            ) : (
              <form onSubmit={submitReset} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                <p style={{ fontFamily: "'Inter', sans-serif", fontSize: 12.5, color: T.pale, margin: 0 }}>
                  Enter the email address on your account and we'll send you a link to reset your password.
                </p>
                <Field label="Email Address">
                  <input type="email" style={inputStyle} value={resetEmail} onChange={(e) => setResetEmail(e.target.value)} />
                </Field>
                <button type="submit" disabled={submitting} style={{ ...solidBtn, marginTop: 6, width: "100%", opacity: submitting ? 0.7 : 1 }}>
                  {submitting ? "Sending..." : "Send Reset Link"}
                </button>
              </form>
            )}
          </div>
        )}

        <p style={{ fontFamily: "'Inter', sans-serif", fontSize: 11.5, color: T.pale, marginTop: 16, textAlign: "center" }}>
          An account is required to stream or download on BetamaxTV.
        </p>
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <label style={{ display: "block" }}>
      <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 11.5, fontWeight: 600, color: T.pale, marginBottom: 6, letterSpacing: "0.03em" }}>
        {label}
      </div>
      {children}
    </label>
  );
}

const inputStyle = {
  width: "100%",
  boxSizing: "border-box",
  fontFamily: "'Inter', sans-serif",
  fontSize: 14,
  background: T.ink,
  color: T.paper,
  border: "1px solid " + T.line,
  borderRadius: 8,
  padding: "10px 12px",
  outline: "none",
};

/* ---------------------------------------------------------
   FOMO ACTIVITY TOASTS
--------------------------------------------------------- */
function FomoToasts({ toasts }) {
  return (
    <div
      style={{
        position: "fixed",
        left: 18,
        bottom: 18,
        zIndex: 90,
        display: "flex",
        flexDirection: "column",
        gap: 8,
        pointerEvents: "none",
      }}
    >
      {toasts.map((t) => (
        <div
          key={t.id}
          className="rp-toast"
          style={{
            background: T.pine,
            border: "1px solid " + T.line,
            borderLeft: "3px solid " + T.mint,
            borderRadius: 10,
            padding: "10px 14px",
            display: "flex",
            alignItems: "center",
            gap: 10,
            boxShadow: "0 8px 24px rgba(0,0,0,0.35)",
            maxWidth: 300,
          }}
        >
          <span style={{ fontSize: 16 }}>{t.action === "download" ? "\u2b07\ufe0f" : "\ud83d\udd34"}</span>
          <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 12.5, color: T.paper, lineHeight: 1.4 }}>
            <strong style={{ color: T.mint }}>{t.name}</strong>{" "}
            {t.action === "download" ? "just downloaded" : "is watching"}{" "}
            <em style={{ fontStyle: "normal", color: T.pale }}>{t.title}</em>
          </div>
        </div>
      ))}
    </div>
  );
}

/* ---------------------------------------------------------
   LIVE CHAT PANEL
--------------------------------------------------------- */
function LiveChat({ open, onClose, messages, onSend, online, user, onAuthOpen }) {
  const [text, setText] = useState("");
  const bottomRef = useRef(null);

  useEffect(() => {
    if (open && bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, open]);

  if (!open) return null;

  function submit(e) {
    e.preventDefault();
    if (!text.trim()) return;
    if (!user) {
      onAuthOpen("signup");
      return;
    }
    onSend(text.trim());
    setText("");
  }

  return (
    <div
      style={{
        position: "fixed",
        right: 18,
        bottom: 18,
        zIndex: 90,
        width: 320,
        maxWidth: "calc(100vw - 36px)",
        height: 440,
        background: T.pine,
        border: "1px solid " + T.line,
        borderRadius: 14,
        display: "flex",
        flexDirection: "column",
        boxShadow: "0 12px 32px rgba(0,0,0,0.4)",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          padding: "12px 16px",
          borderBottom: "1px solid " + T.line,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexShrink: 0,
        }}
      >
        <div>
          <div style={{ fontFamily: "'Jost', sans-serif", fontWeight: 700, fontSize: 14.5, color: T.paper }}>
            Live Chat
          </div>
          <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 11, color: T.pale, display: "flex", alignItems: "center", gap: 5 }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: T.mint, display: "inline-block" }} />
            {online} watching along
          </div>
        </div>
        <button onClick={onClose} style={{ all: "unset", cursor: "pointer", color: T.pale, fontSize: 18 }}>
          &times;
        </button>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: "14px 16px", display: "flex", flexDirection: "column", gap: 12 }}>
        {messages.map((m) => (
          <div key={m.id} style={{ maxWidth: "85%", alignSelf: m.self ? "flex-end" : "flex-start" }}>
            {!m.self && (
              <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 11, fontWeight: 700, color: T.mint, marginBottom: 2 }}>
                {m.name}
              </div>
            )}
            <div
              style={{
                fontFamily: "'Inter', sans-serif",
                fontSize: 12.5,
                lineHeight: 1.4,
                color: m.self ? T.charcoal : T.paper,
                background: m.self ? T.mint : T.ink,
                border: m.self ? "none" : "1px solid " + T.line,
                borderRadius: 10,
                padding: "8px 11px",
              }}
            >
              {m.text}
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {!user && (
        <div style={{ padding: "0 12px 8px", fontFamily: "'Inter', sans-serif", fontSize: 11, color: T.pale }}>
          Create a free account to send messages.
        </div>
      )}
      <form onSubmit={submit} style={{ display: "flex", gap: 8, padding: 12, paddingTop: user ? 12 : 0, borderTop: "1px solid " + T.line, flexShrink: 0 }}>
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={user ? `Chat as ${user.username}...` : "Type a message..."}
          style={{ ...inputStyle, flex: 1 }}
        />
        <button type="submit" style={{ ...solidBtn, padding: "10px 14px" }}>
          &#10148;
        </button>
      </form>
    </div>
  );
}

/* ---------------------------------------------------------
   HEADER
--------------------------------------------------------- */
function ChatBadge({ count }) {
  return (
    <span
      className="rp-chat-badge"
      style={{
        position: "absolute",
        top: -6,
        right: -6,
        minWidth: 18,
        height: 18,
        padding: "0 4px",
        borderRadius: 999,
        background: "#ff4d4f",
        color: "#fff",
        fontFamily: "'Inter', sans-serif",
        fontSize: 10.5,
        fontWeight: 700,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        lineHeight: 1,
        boxShadow: "0 0 0 2px " + T.ink,
      }}
    >
      {count > 9 ? "9+" : count}
    </span>
  );
}

function Header({ query, setQuery, typeFilter, setTypeFilter, onAdvanced, user, onAuthOpen, onLogout, onLogo, onChatToggle, chatOpen, unreadChat, onResendVerification, resendStatus }) {
  return (
    <header
      style={{
        position: "sticky",
        top: 0,
        zIndex: 40,
        background: "rgba(11,50,45,0.92)",
        backdropFilter: "blur(8px)",
        borderBottom: "1px solid " + T.line,
      }}
    >
      <div
        style={{
          maxWidth: 1180,
          margin: "0 auto",
          padding: "14px 24px",
          display: "flex",
          alignItems: "center",
          gap: 28,
          flexWrap: "wrap",
        }}
      >
        <button onClick={onLogo} style={{ all: "unset", cursor: "pointer" }}>
          <Logo />
        </button>

        <nav style={{ display: "flex", gap: 20 }}>
          {[
            ["all", "Home"],
            ["movie", "Movies"],
            ["tv", "TV Shows"],
          ].map(([val, label]) => (
            <button
              key={val}
              onClick={() => setTypeFilter(val)}
              style={{
                all: "unset",
                cursor: "pointer",
                fontFamily: "'Inter', sans-serif",
                fontSize: 13.5,
                fontWeight: 600,
                color: typeFilter === val ? T.mint : T.paper,
              }}
            >
              {label}
            </button>
          ))}
        </nav>

        <div style={{ flex: 1, minWidth: 160, display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ position: "relative", flex: 1, maxWidth: 340 }}>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search titles..."
              style={{
                width: "100%",
                boxSizing: "border-box",
                fontFamily: "'Inter', sans-serif",
                fontSize: 13,
                background: T.ink,
                color: T.paper,
                border: "1px solid " + T.line,
                borderRadius: 999,
                padding: "9px 14px 9px 32px",
                outline: "none",
              }}
            />
            <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: T.pale, fontSize: 13 }}>
              &#128269;
            </span>
          </div>
          <button
            onClick={onAdvanced}
            style={{
              all: "unset",
              cursor: "pointer",
              fontFamily: "'Inter', sans-serif",
              fontSize: 12,
              fontWeight: 600,
              color: T.pale,
              whiteSpace: "nowrap",
              borderBottom: "1px dashed " + T.pale,
            }}
          >
            Advanced Search
          </button>
        </div>

        {user ? (
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <button
              onClick={onChatToggle}
              style={{
                ...ghostBtn,
                position: "relative",
                display: "flex",
                alignItems: "center",
                gap: 6,
                borderColor: chatOpen ? T.mint : unreadChat > 0 ? "#ff4d4f" : T.line,
                color: chatOpen ? T.mint : T.paper,
              }}
            >
              &#128172; Live Chat
              {!chatOpen && unreadChat > 0 && <ChatBadge count={unreadChat} />}
            </button>
            <span style={{ fontFamily: "'Inter', sans-serif", fontSize: 13, color: T.paper, display: "flex", alignItems: "center", gap: 6 }}>
              Hi, {user.username}
              {!user.emailVerified && (
                <button
                  onClick={onResendVerification}
                  title="Click to resend the confirmation email"
                  disabled={resendStatus === "sending"}
                  style={{
                    all: "unset",
                    cursor: resendStatus === "sending" ? "default" : "pointer",
                    fontFamily: "'Inter', sans-serif",
                    fontSize: 10,
                    fontWeight: 700,
                    letterSpacing: "0.04em",
                    color: T.charcoal,
                    background: T.pale,
                    borderRadius: 999,
                    padding: "3px 9px",
                  }}
                >
                  {resendStatus === "sending"
                    ? "SENDING..."
                    : resendStatus === "sent"
                    ? "SENT \u2713 CHECK INBOX"
                    : resendStatus === "error"
                    ? "FAILED \u2014 RETRY"
                    : "VERIFY EMAIL"}
                </button>
              )}
            </span>
            <button onClick={onLogout} style={ghostBtn}>
              Sign Out
            </button>
          </div>
        ) : (
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <button
              onClick={onChatToggle}
              style={{
                ...ghostBtn,
                position: "relative",
                display: "flex",
                alignItems: "center",
                gap: 6,
                borderColor: chatOpen ? T.mint : unreadChat > 0 ? "#ff4d4f" : T.line,
                color: chatOpen ? T.mint : T.paper,
              }}
            >
              &#128172; Live Chat
              {!chatOpen && unreadChat > 0 && <ChatBadge count={unreadChat} />}
            </button>
            <button onClick={() => onAuthOpen("signin")} style={solidBtn}>
              Sign In
            </button>
          </div>
        )}
      </div>
    </header>
  );
}

/* ---------------------------------------------------------
   LIBRARY GRID
--------------------------------------------------------- */
function Library({ items, onOpen, typeFilter }) {
  const heading = typeFilter === "movie" ? "All Movies" : typeFilter === "tv" ? "All TV Shows" : "The Library";
  return (
    <section style={{ maxWidth: 1180, margin: "0 auto", padding: "40px 24px 80px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 22 }}>
        <h2 style={{ fontFamily: "'Jost', sans-serif", fontWeight: 700, fontSize: 24, color: T.paper, margin: 0 }}>
          {heading}
        </h2>
        <span style={{ fontFamily: "'Inter', sans-serif", fontSize: 12.5, color: T.pale }}>
          {items.length} title{items.length === 1 ? "" : "s"}
        </span>
      </div>
      {items.length === 0 ? (
        <div style={{ fontFamily: "'Inter', sans-serif", color: T.pale, fontSize: 14, padding: "40px 0" }}>
          No titles match your filters. Try widening your search.
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: 18 }}>
          {items.map((item) => (
            <Poster key={item.id} item={item} onClick={() => onOpen(item.id)} />
          ))}
        </div>
      )}
    </section>
  );
}

/* ---------------------------------------------------------
   DETAIL PAGE
--------------------------------------------------------- */
function TrailerModal({ open, onClose, item }) {
  if (!open || !item?.trailer) return null;
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(11,31,27,0.85)",
        zIndex: 80,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ width: "100%", maxWidth: 900 }}
      >
        <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 8 }}>
          <button onClick={onClose} style={{ all: "unset", cursor: "pointer", color: T.paper, fontSize: 26 }}>
            &times;
          </button>
        </div>
        <div
          style={{
            position: "relative",
            width: "100%",
            aspectRatio: "16 / 9",
            background: "#000",
            borderRadius: 12,
            overflow: "hidden",
            border: "1px solid " + T.line,
          }}
        >
          <iframe
            src={`${item.trailer}${item.trailer.includes("?") ? "&" : "?"}autoplay=1`}
            title={`${item.title} — Trailer`}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            style={{ position: "absolute", inset: 0, width: "100%", height: "100%", border: 0 }}
          />
        </div>
      </div>
    </div>
  );
}

function Detail({ item, user, onAuthOpen, onBack, onWatch, onDownload, onWatchEpisode }) {
  const [name, setName] = useState(user ? user.username : "");
  const [text, setText] = useState("");
  const [comments, setComments] = useState([]);
  const [commentsLoading, setCommentsLoading] = useState(true);
  const [commentsError, setCommentsError] = useState("");
  const [posting, setPosting] = useState(false);
  const [trailerOpen, setTrailerOpen] = useState(false);

  useEffect(() => {
    setName(user ? user.username : "");
  }, [user]);

  // Live-subscribe to this title's comments in Firestore so they persist
  // across refreshes and update in real time for everyone viewing the page.
  // NOTE: we deliberately do NOT use orderBy() in the Firestore query itself —
  // combining a where() filter with orderBy() on a different field requires a
  // manually-created "composite index" in the Firebase Console. Sorting here
  // in JS instead avoids that extra setup step entirely.
  useEffect(() => {
    setCommentsLoading(true);
    setCommentsError("");
    const q = fsQuery(collection(db, "comments"), where("titleId", "==", item.id));
    const unsub = onSnapshot(
      q,
      (snap) => {
        const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        rows.sort((a, b) => (a.createdAt?.seconds ?? 0) - (b.createdAt?.seconds ?? 0));
        setComments(rows);
        setCommentsLoading(false);
      },
      (err) => {
        console.error("Failed to load comments:", err);
        setCommentsError("Comments couldn't be loaded right now.");
        setCommentsLoading(false);
      }
    );
    return () => unsub();
  }, [item.id]);

  function requireAuth(action) {
    if (!user) {
      onAuthOpen("signup");
      return;
    }
    action();
  }

  async function submitComment(e) {
    e.preventDefault();
    if (!text.trim() || posting) return;
    setPosting(true);
    setCommentsError("");
    try {
      await addDoc(collection(db, "comments"), {
        titleId: item.id,
        name: (name || "Guest").trim().slice(0, 60),
        text: text.trim().slice(0, 1000),
        uid: user ? user.uid : null,
        createdAt: serverTimestamp(),
      });
      setText("");
    } catch (err) {
      console.error("Failed to post comment:", err);
      setCommentsError("Couldn't post your comment — please try again.");
    } finally {
      setPosting(false);
    }
  }

  return (
    <div style={{ maxWidth: 1180, margin: "0 auto", padding: "32px 24px 80px" }}>
      <button onClick={onBack} style={{ ...ghostBtn, marginBottom: 24 }}>
        &larr; Back to Library
      </button>

      <div style={{ display: "flex", gap: 36, flexWrap: "wrap" }}>
        <div style={{ width: 280, flexShrink: 0 }}>
          <Poster item={item} onClick={() => {}} />
        </div>

        <div style={{ flex: 1, minWidth: 280 }}>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
            <Badge>{item.type === "tv" ? "TV Show" : "Movie"}</Badge>
            <Badge>{item.category}</Badge>
            <Badge>{item.year}</Badge>
            <Badge>{item.language}</Badge>
            {item.quality.map((q) => (
              <Badge key={q} tone={q === "4K" ? "solid" : "outline"}>
                {q}
              </Badge>
            ))}
          </div>

          <h1 style={{ fontFamily: "'Jost', sans-serif", fontWeight: 700, fontSize: 34, color: T.paper, margin: "0 0 14px" }}>
            {item.title}
          </h1>

          <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap", marginBottom: 20 }}>
            {item.showRt && <RTBadge score={item.rt} />}
            {item.showImdb && <IMDBBadge score={item.imdb} />}
          </div>

          <p style={{ fontFamily: "'Inter', sans-serif", fontSize: 15, color: T.pale, lineHeight: 1.6, margin: "20px 0 26px", maxWidth: 620 }}>
            {item.desc}
          </p>

          <div style={{ display: "flex", gap: 12 }}>
            {item.type !== "tv" && (
              <button onClick={() => requireAuth(() => onWatch(item))} style={solidBtn}>
                &#9654; Watch Now
              </button>
            )}
            {item.type !== "tv" && (
              <button onClick={() => requireAuth(() => onDownload(item))} style={ghostBtn}>
                &#11015; Download
              </button>
            )}
            {item.trailer && (
              <button onClick={() => setTrailerOpen(true)} style={ghostBtn}>
                &#9654; Watch Trailer
              </button>
            )}
          </div>
          {!user && (
            <p style={{ fontFamily: "'Inter', sans-serif", fontSize: 12, color: T.pale, marginTop: 10 }}>
              Sign in or create a free account to stream and download.
            </p>
          )}
        </div>
      </div>

      {item.type === "tv" && item.seasons && item.seasons.length > 0 && (
        <>
          <div style={{ height: 1, background: T.line, margin: "44px 0 28px" }} />
          <h3 style={{ fontFamily: "'Jost', sans-serif", fontWeight: 700, fontSize: 19, color: T.paper, marginBottom: 14 }}>
            Watch the Episodes
          </h3>
          {item.seasons.map((s) => (
            <SeasonAccordion
              key={s.season}
              season={s}
              onWatchEpisode={(season, ep) => requireAuth(() => onWatchEpisode(item, season, ep))}
            />
          ))}
        </>
      )}

      <div style={{ height: 1, background: T.line, margin: "44px 0 30px" }} />

      <h3 style={{ fontFamily: "'Jost', sans-serif", fontWeight: 700, fontSize: 19, color: T.paper, marginBottom: 18 }}>
        Comments &amp; Feedback ({comments.length})
      </h3>

      <form onSubmit={submitComment} style={{ marginBottom: 28, maxWidth: 520 }}>
        <div style={{ display: "flex", gap: 10, marginBottom: 10 }}>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your name"
            style={{ ...inputStyle, maxWidth: 200 }}
          />
        </div>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Share your thoughts on this title..."
          rows={3}
          style={{ ...inputStyle, resize: "vertical", marginBottom: 10 }}
        />
        <button type="submit" style={solidBtn} disabled={posting}>
          {posting ? "Posting..." : "Post Comment"}
        </button>
        {commentsError && (
          <p style={{ fontFamily: "'Inter', sans-serif", fontSize: 12.5, color: "#E8836B", marginTop: 10 }}>
            {commentsError}
          </p>
        )}
      </form>

      <div style={{ display: "flex", flexDirection: "column", gap: 16, maxWidth: 620 }}>
        {commentsLoading && (
          <p style={{ fontFamily: "'Inter', sans-serif", color: T.pale, fontSize: 13.5 }}>Loading comments...</p>
        )}
        {!commentsLoading && comments.length === 0 && (
          <p style={{ fontFamily: "'Inter', sans-serif", color: T.pale, fontSize: 13.5 }}>
            No comments yet &mdash; be the first to share your take.
          </p>
        )}
        {comments.map((c) => (
          <div key={c.id} style={{ borderTop: "1px solid " + T.line, paddingTop: 14 }}>
            <div style={{ fontFamily: "'Jost', sans-serif", fontWeight: 600, fontSize: 13.5, color: T.mint }}>
              {c.name}
            </div>
            <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 13.5, color: T.paper, marginTop: 4, lineHeight: 1.5 }}>
              {c.text}
            </div>
          </div>
        ))}
      </div>

      <TrailerModal open={trailerOpen} onClose={() => setTrailerOpen(false)} item={item} />
    </div>
  );
}

/* ---------------------------------------------------------
   WATCH — the actual video player page
--------------------------------------------------------- */


function Watch({ item, backLabel, onBack }) {
  return (
    <div style={{ maxWidth: 1180, margin: "0 auto", padding: "32px 24px 80px" }}>
      <button onClick={onBack} style={{ ...ghostBtn, marginBottom: 20 }}>
        &larr; Back to {backLabel || item.title}
      </button>

      <div
        style={{
          display: "flex",
          gap: 12,
          alignItems: "flex-start",
          background: "rgba(23,216,151,0.08)",
          border: "1px solid rgba(23,216,151,0.3)",
          borderRadius: 10,
          padding: "14px 18px",
          marginBottom: 16,
        }}
      >
        <span style={{ fontSize: 22, lineHeight: 1.4, color: "#FFD24C" }}>&#9888;</span>
        <p style={{ fontFamily: "'Inter', sans-serif", fontSize: 15.5, color: T.paper, lineHeight: 1.6, margin: 0 }}>
          You may need to click the play button <strong style={{ color: "#FFD24C" }}>4&ndash;5 times</strong> before
          the film starts &mdash; the first few clicks open ads that help keep this site running at no cost to you.
          Thanks for your patience, and enjoy the film once the player loads!
        </p>
      </div>

      {item.embed ? (
        <div
          style={{
            position: "relative",
            width: "100%",
            aspectRatio: "16 / 9",
            background: "#000",
            borderRadius: 12,
            overflow: "hidden",
            border: "1px solid " + T.line,
          }}
        >
          <iframe
            src={item.embed}
            title={item.title}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            style={{ position: "absolute", inset: 0, width: "100%", height: "100%", border: 0 }}
          />
        </div>
      ) : (
        <div
          style={{
            width: "100%",
            aspectRatio: "16 / 9",
            background: T.pine,
            borderRadius: 12,
            border: "1px solid " + T.line,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontFamily: "'Inter', sans-serif",
            color: T.pale,
            fontSize: 14,
            textAlign: "center",
            padding: 24,
          }}
        >
          No video source configured yet for this title.
        </div>
      )}

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", margin: "20px 0 6px" }}>
        <Badge>{item.type === "tv" ? "TV Show" : "Movie"}</Badge>
        <Badge>{item.category}</Badge>
        <Badge>{item.year}</Badge>
        <Badge>{item.language}</Badge>
        {item.quality.map((q) => (
          <Badge key={q} tone={q === "4K" ? "solid" : "outline"}>
            {q}
          </Badge>
        ))}
      </div>

      <h1 style={{ fontFamily: "'Jost', sans-serif", fontWeight: 700, fontSize: 26, color: T.paper, margin: "0 0 6px" }}>
        {item.title}
      </h1>
      <p style={{ fontFamily: "'Inter', sans-serif", fontSize: 13.5, color: T.pale, maxWidth: 640 }}>{item.desc}</p>
    </div>
  );
}

/* ---------------------------------------------------------
   REQUEST MODAL — signed-in users can suggest a title to add.
   Guests are redirected to sign up first (see Footer below).
--------------------------------------------------------- */
function RequestModal({ open, onClose, user }) {
  const [text, setText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);

  if (!open) return null;

  function handleClose() {
    onClose();
    setTimeout(() => {
      setText("");
      setError("");
      setSent(false);
    }, 200);
  }

  async function submitRequest(e) {
    e.preventDefault();
    if (!text.trim() || submitting || !user) return;
    setSubmitting(true);
    setError("");
    try {
      await addDoc(collection(db, "requests"), {
        uid: user.uid,
        username: user.username,
        text: text.trim().slice(0, 2000),
        createdAt: serverTimestamp(),
      });
      setSent(true);
    } catch (err) {
      console.error("Failed to submit request:", err);
      setError("Couldn't send your request — please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(11,31,27,0.7)",
        zIndex: 60,
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "center",
        padding: "60px 20px",
        overflowY: "auto",
      }}
      onClick={handleClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: T.pine,
          border: "1px solid " + T.line,
          borderRadius: 14,
          maxWidth: 520,
          width: "100%",
          padding: 32,
        }}
      >
        {sent ? (
          <div style={{ textAlign: "center", padding: "12px 0" }}>
            <div style={{ fontSize: 34, marginBottom: 14 }}>&#127881;</div>
            <h3 style={{ fontFamily: "'Jost', sans-serif", color: T.paper, fontSize: 21, margin: "0 0 10px", fontWeight: 700 }}>
              Salamat sa iyong request!
            </h3>
            <p style={{ fontFamily: "'Inter', sans-serif", color: T.pale, fontSize: 14, margin: "0 0 24px", lineHeight: 1.5 }}>
              Ire-review namin ito at susubukan naming idagdag ang hiling mo sa lalong madaling panahon.
            </p>
            <button onClick={handleClose} style={solidBtn}>
              Isara
            </button>
          </div>
        ) : (
          <>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <h3 style={{ fontFamily: "'Jost', sans-serif", color: T.paper, fontSize: 22, margin: 0, fontWeight: 700 }}>
                Mag-request ng Panonoorin
              </h3>
              <button onClick={handleClose} style={{ all: "unset", cursor: "pointer", color: T.pale, fontSize: 20 }}>
                &times;
              </button>
            </div>
            <p style={{ fontFamily: "'Inter', sans-serif", color: T.pale, fontSize: 13.5, margin: "0 0 20px" }}>
              Isulat ang movie o TV show na gusto mong idagdag sa BetamaxTV.
            </p>
            <form onSubmit={submitRequest}>
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Hal. Squid Game Season 3, Dune Part 3..."
                rows={6}
                style={{ ...inputStyle, width: "100%", resize: "vertical", fontFamily: "'Inter', sans-serif" }}
              />
              {error && (
                <div style={{ fontFamily: "'Inter', sans-serif", color: "#ff9d9d", fontSize: 12.5, marginTop: 8 }}>
                  {error}
                </div>
              )}
              <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 18 }}>
                <button type="submit" style={solidBtn} disabled={submitting || !text.trim()}>
                  {submitting ? "Sending..." : "Submit your Request"}
                </button>
              </div>
            </form>
          </>
        )}
      </div>
    </div>
  );
}

function Footer({ user, onAuthOpen, onRequestOpen }) {
  return (
    <footer style={{ background: T.ink, borderTop: "1px solid " + T.line, padding: "56px 24px" }}>
      <div style={{ maxWidth: 1180, margin: "0 auto", textAlign: "center" }}>
        <div style={{ display: "flex", justifyContent: "center" }}>
          <Logo />
        </div>
        <h3 style={{ fontFamily: "'Jost', sans-serif", fontWeight: 700, fontSize: 26, color: T.paper, margin: "22px auto 20px", maxWidth: 420 }}>
          Wala ba dito ang hanap mo?
        </h3>
        <button
          onClick={() => (user ? onRequestOpen() : onAuthOpen("signup"))}
          style={{
            fontFamily: "'Inter', sans-serif",
            fontWeight: 800,
            fontSize: 17,
            letterSpacing: "0.01em",
            background: T.mint,
            color: T.charcoal,
            border: "1px solid " + T.mint,
            borderRadius: 10,
            padding: "18px 34px",
            cursor: "pointer",
          }}
        >
          File your Request Here!
        </button>
      </div>
    </footer>
  );
}

/* ---------------------------------------------------------
   APP
--------------------------------------------------------- */
export default function App() {
  const [catalog, setCatalog] = useState(CATALOG);
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [filters, setFilters] = useState({ category: [], quality: [], genre: [], language: [], yearFrom: 1900, yearTo: 2026 });
  const [appliedFilters, setAppliedFilters] = useState(filters);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState("signup");
  const [user, setUser] = useState(null);
  const [view, setView] = useState("home");
  const [selectedId, setSelectedId] = useState(null);
  const [watchEpisode, setWatchEpisode] = useState(null); // { seasonNum, title, url } while watching a specific episode, else null
  const [toasts, setToasts] = useState([]);
  const [chatOpen, setChatOpen] = useState(false);
  const [botMessages, setBotMessages] = useState(() =>
    CHAT_SEED.map((m, i) => ({ id: "seed-" + i, name: m.name, text: m.text, ts: i }))
  );
  const [chatMessages, setChatMessages] = useState([]);
  const [online, setOnline] = useState(214);
  const [authLoading, setAuthLoading] = useState(true);
  const [resendStatus, setResendStatus] = useState("");
  const [requestOpen, setRequestOpen] = useState(false);
  const [unreadChat, setUnreadChat] = useState(0);
  const prevMsgLenRef = useRef(0);
  const ipRef = useRef(null);
  const lastLoggedPageRef = useRef(null);

  // Fetch the visitor's public IP once per session (via a free lookup
  // service — browsers can't read this directly), then log the first
  // page view. If the lookup fails (e.g. offline, ad-blocker), we still
  // log the visit with ip: "unknown" rather than losing the row.
  useEffect(() => {
    let cancelled = false;
    fetch("https://api.ipify.org?format=json")
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled) ipRef.current = data.ip || "unknown";
      })
      .catch(() => {
        if (!cancelled) ipRef.current = "unknown";
      })
      .finally(() => {
        if (!cancelled) logVisit(view);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Log again whenever the user navigates to a different page/view
  // (home, detail, watch, etc.) — skipped on first mount since the
  // effect above already logs it once the IP lookup finishes.
  useEffect(() => {
    if (lastLoggedPageRef.current === null) {
      lastLoggedPageRef.current = view;
      return;
    }
    if (lastLoggedPageRef.current === view) return;
    lastLoggedPageRef.current = view;
    logVisit(view);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view]);

  function logVisit(page) {
    addDoc(collection(db, "analytics"), {
      page: page || "home",
      deviceType: getDeviceType(),
      browser: getBrowserName(),
      os: getOSName(),
      screenSize: getScreenSize(),
      ip: ipRef.current || "unknown",
      uid: user ? user.uid : null,
      timestamp: serverTimestamp(),
    }).catch((err) => {
      console.error("Failed to log visit:", err);
    });
  }

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (fbUser) => {
      if (fbUser) {
        const snap = await getDoc(doc(db, "users", fbUser.uid));
        const profile = snap.exists() ? snap.data() : {};
        setUser({
          uid: fbUser.uid,
          username: profile.username || fbUser.displayName || fbUser.email,
          email: fbUser.email,
          favGenre: profile.favGenre || PROFILE_GENRE_OPTIONS[0],
          favShow: profile.favShow || "",
          emailVerified: fbUser.emailVerified,
        });
      } else {
        setUser(null);
      }
      setAuthLoading(false);
    });
    return () => unsub();
  }, []);

  // Live-subscribe to the global Live Chat feed in Firestore, so real user
  // messages persist across refreshes and sync in real time for everyone.
  // Ordered + capped at the query level (single-field orderBy needs no
  // composite index), newest 100 kept, then re-reversed into chat order.
  useEffect(() => {
    const q = fsQuery(collection(db, "chats"), orderBy("createdAt", "desc"), limit(100));
    const unsub = onSnapshot(
      q,
      (snap) => {
        const rows = snap.docs.map((d) => {
          const data = d.data();
          return {
            id: d.id,
            uid: data.uid,
            name: data.name,
            text: data.text,
            ts: data.createdAt?.seconds ? data.createdAt.seconds * 1000 : Date.now(),
          };
        });
        rows.reverse();
        setChatMessages(rows);
      },
      (err) => {
        console.error("Failed to load live chat:", err);
      }
    );
    return () => unsub();
  }, []);

  // Merge the simulated ambient "bot" chatter with real Firestore-backed
  // user messages into one chronological feed for the chat panel.
  const messages = useMemo(() => {
    const bot = botMessages.map((m) => ({ ...m, self: false }));
    const real = chatMessages.map((m) => ({ ...m, self: user ? m.uid === user.uid : false }));
    return [...bot, ...real].sort((a, b) => a.ts - b.ts);
  }, [botMessages, chatMessages, user]);


  useEffect(() => {
    const spawn = () => {
      const item = randomFrom(catalog);
      const toast = {
        id: Date.now() + Math.random(),
        name: randomFrom(FAKE_NAMES),
        action: Math.random() > 0.5 ? "download" : "watch",
        title: item.title,
      };
      setToasts((prev) => [...prev.slice(-2), toast]);
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== toast.id));
      }, 5200);
    };
    const first = setTimeout(spawn, 2500);
    const interval = setInterval(spawn, 7000);
    return () => {
      clearTimeout(first);
      clearInterval(interval);
    };
  }, [catalog]);

  useEffect(() => {
    const chatInterval = setInterval(() => {
      const item = randomFrom(catalog);
      const r = Math.random();
      const category = r < 0.15 ? "greeting" : r < 0.4 ? "genre" : "generic";
      setBotMessages((prev) => [
        ...prev,
        { id: Date.now() + Math.random(), name: randomFrom(FAKE_NAMES), text: pickChatterLine(category, item), ts: Date.now() },
      ]);
    }, 14000);
    const onlineInterval = setInterval(() => {
      setOnline((o) => Math.max(120, o + Math.floor(Math.random() * 11) - 5));
    }, 6000);
    return () => {
      clearInterval(chatInterval);
      clearInterval(onlineInterval);
    };
  }, [catalog]);

  // Track unread live-chat messages: every message added while the panel
  // is closed bumps the counter; opening the panel clears it.
  useEffect(() => {
    const prevLen = prevMsgLenRef.current;
    const newOnes = messages.slice(prevLen);
    prevMsgLenRef.current = messages.length;
    if (!chatOpen && newOnes.some((m) => !m.self)) {
      setUnreadChat((n) => n + newOnes.filter((m) => !m.self).length);
    }
  }, [messages, chatOpen]);

  useEffect(() => {
    if (chatOpen) setUnreadChat(0);
  }, [chatOpen]);

  function pushToast(name, action, title) {
    const toast = { id: Date.now() + Math.random(), name, action, title };
    setToasts((prev) => [...prev.slice(-2), toast]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== toast.id));
    }, 5200);
  }

  function sendMessage(text) {
    if (!user) return;
    const trimmed = text.trim().slice(0, 500);
    if (!trimmed) return;
    addDoc(collection(db, "chats"), {
      uid: user.uid,
      name: user.username,
      text: trimmed,
      createdAt: serverTimestamp(),
    }).catch((err) => {
      console.error("Failed to send chat message:", err);
    });
    queueFakeReply(trimmed);
  }

  // Simulates a reply from a fellow "viewer" using the local CHATTER_BANK +
  // lightweight keyword matching (classifyMessage), so chat still feels
  // responsive without needing a live backend. A real AI-powered version of
  // this (Gemini via a Cloud Function) is already built in
  // /functions/index.js — swap this out for that once the Firebase project
  // is on the Blaze plan and the GEMINI_API_KEY secret is set.
  function queueFakeReply(userText) {
    const currentItem = catalog.find((v) => v.id === selectedId) || randomFrom(catalog);
    const category = classifyMessage(userText);

    const delay = 700 + Math.random() * 1800;
    setTimeout(() => {
      setBotMessages((prev) => [
        ...prev,
        { id: Date.now() + Math.random(), name: randomFrom(FAKE_NAMES), text: pickChatterLine(category, currentItem), ts: Date.now() },
      ]);
    }, delay);

    // Occasionally a second viewer chimes in too, like a real chat would.
    if (Math.random() < 0.35) {
      const delay2 = delay + 900 + Math.random() * 1500;
      setTimeout(() => {
        setBotMessages((prev) => [
          ...prev,
          { id: Date.now() + Math.random(), name: randomFrom(FAKE_NAMES), text: pickChatterLine("agree", currentItem), ts: Date.now() },
        ]);
      }, delay2);
    }
  }

  const filtered = useMemo(() => {
    return catalog.filter((v) => {
      if (typeFilter !== "all" && v.type !== typeFilter) return false;
      if (query && !v.title.toLowerCase().includes(query.toLowerCase())) return false;
      if (appliedFilters.category.length && !appliedFilters.category.includes(v.category)) return false;
      if (appliedFilters.quality.length && !v.quality.some((q) => appliedFilters.quality.includes(q))) return false;
      if (appliedFilters.genre.length && !appliedFilters.genre.includes(v.genre)) return false;
      if (appliedFilters.language.length && !appliedFilters.language.includes(v.language)) return false;
      if (v.year < appliedFilters.yearFrom || v.year > appliedFilters.yearTo) return false;
      return true;
    });
  }, [catalog, query, typeFilter, appliedFilters]);

  // Filter chip lists auto-derive from whatever's actually in the catalog —
  // add a new category/genre/language/quality to a title above and it just
  // shows up here, no separate list to keep in sync.
  const categoryOptions = useMemo(
    () => Array.from(new Set(catalog.map((v) => v.category))).sort(),
    [catalog]
  );
  const genreOptions = useMemo(
    () => Array.from(new Set(catalog.map((v) => v.genre))).sort(),
    [catalog]
  );
  const languageOptions = useMemo(
    () => Array.from(new Set(catalog.map((v) => v.language))).sort(),
    [catalog]
  );
  const qualityOptions = useMemo(() => {
    const found = Array.from(new Set(catalog.flatMap((v) => v.quality)));
    return found.sort((a, b) => {
      const ra = QUALITY_ORDER.indexOf(a);
      const rb = QUALITY_ORDER.indexOf(b);
      if (ra === -1 && rb === -1) return a.localeCompare(b);
      if (ra === -1) return 1;
      if (rb === -1) return -1;
      return ra - rb;
    });
  }, [catalog]);

  const selected = catalog.find((v) => v.id === selectedId);

  function openDetail(id) {
    setSelectedId(id);
    setView("detail");
    window.scrollTo({ top: 0 });
  }

  function handleAuth(u) {
    setUser(u);
    setAuthOpen(false);
  }

  function resendVerification() {
    if (!auth.currentUser || resendStatus === "sending") return;
    setResendStatus("sending");
    sendEmailVerification(auth.currentUser)
      .then(() => {
        setResendStatus("sent");
        setTimeout(() => setResendStatus(""), 6000);
      })
      .catch((err) => {
        console.error("Resend verification failed:", err);
        setResendStatus("error");
        setTimeout(() => setResendStatus(""), 6000);
      });
  }

  function handleWatch(item) {
    pushToast(user ? user.username : "You", "watch", item.title);
    setWatchEpisode(null);
    setView("watch");
    window.scrollTo({ top: 0 });
  }

  function handleWatchEpisode(item, season, ep) {
    pushToast(user ? user.username : "You", "watch", `${item.title} — ${ep.title}`);
    setWatchEpisode({ seasonNum: season.season, title: ep.title, url: ep.url });
    setView("watch");
    window.scrollTo({ top: 0 });
  }

  function handleDownload(item) {
    pushToast(user ? user.username : "You", "download", item.title);
    if (item.download) {
      window.open(item.download, "_blank", "noopener,noreferrer");
    }
  }

  return (
    <div style={{ background: T.ink, minHeight: "100%", fontFamily: "'Inter', sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Jost:wght@500;600;700&family=Inter:wght@400;500;600;700&display=swap');
        * { box-sizing: border-box; }
        html, body { margin: 0; padding: 0; background: ${T.ink}; }
        #root { min-height: 100%; }
        input::placeholder, textarea::placeholder { color: rgba(243,245,240,0.4); }
        .rp-strip { animation: rp-scroll 38s linear infinite; }
        .rp-strip-mask:hover .rp-strip { animation-play-state: paused; }
        @keyframes rp-scroll {
          from { transform: translateX(0); }
          to { transform: translateX(-50%); }
        }
        .rp-poster:hover { transform: translateY(-4px); }
        .rp-chat-badge { animation: rp-badge-pulse 1.4s ease-in-out infinite; }
        @keyframes rp-badge-pulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.18); }
        }
        .rp-toast { animation: rp-toast-in 0.35s ease; }
        @keyframes rp-toast-in {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @media (max-width: 640px) {
          .rp-headline-row { flex-direction: column; }
        }
      `}</style>

      <Header
        query={query}
        setQuery={setQuery}
        typeFilter={typeFilter}
        setTypeFilter={(t) => {
          setTypeFilter(t);
          setView("home");
        }}
        onAdvanced={() => setAdvancedOpen(true)}
        user={user}
        onAuthOpen={(m) => {
          setAuthMode(m);
          setAuthOpen(true);
        }}
        onLogout={() => signOut(auth)}
        onLogo={() => setView("home")}
        onChatToggle={() => setChatOpen((o) => !o)}
        chatOpen={chatOpen}
        unreadChat={unreadChat}
        onResendVerification={resendVerification}
        resendStatus={resendStatus}
      />

      {view === "home" ? (
        <>
          <Hero onOpen={openDetail} />
          <Library items={filtered} onOpen={openDetail} typeFilter={typeFilter} />
        </>
      ) : view === "watch" ? (
        selected && (
          <Watch
            item={
              watchEpisode
                ? {
                    ...selected,
                    title: `${selected.title} — S${watchEpisode.seasonNum}: ${watchEpisode.title}`,
                    embed: watchEpisode.url ? toYouTubeEmbed(watchEpisode.url) : selected.embed,
                  }
                : selected
            }
            backLabel={selected.title}
            onBack={() => {
              setWatchEpisode(null);
              setView("detail");
            }}
          />
        )
      ) : (
        selected && (
          <Detail
            item={selected}
            user={user}
            onAuthOpen={(m) => {
              setAuthMode(m);
              setAuthOpen(true);
            }}
            onBack={() => setView("home")}
            onWatch={handleWatch}
            onDownload={handleDownload}
            onWatchEpisode={handleWatchEpisode}
          />
        )
      )}

      <Footer
        user={user}
        onAuthOpen={(m) => {
          setAuthMode(m);
          setAuthOpen(true);
        }}
        onRequestOpen={() => setRequestOpen(true)}
      />

      <FomoToasts toasts={toasts} />

      <LiveChat
        open={chatOpen}
        onClose={() => setChatOpen(false)}
        messages={messages}
        onSend={sendMessage}
        online={online}
        user={user}
        onAuthOpen={(m) => {
          setAuthMode(m);
          setAuthOpen(true);
        }}
      />

      <AdvancedSearch
        open={advancedOpen}
        onClose={() => setAdvancedOpen(false)}
        filters={filters}
        setFilters={setFilters}
        categoryOptions={categoryOptions}
        genreOptions={genreOptions}
        languageOptions={languageOptions}
        qualityOptions={qualityOptions}
        onApply={() => {
          setAppliedFilters(filters);
          setAdvancedOpen(false);
          setView("home");
        }}
      />

      <AuthModal open={authOpen} onClose={() => setAuthOpen(false)} onAuth={handleAuth} initialMode={authMode} />

      <RequestModal open={requestOpen} onClose={() => setRequestOpen(false)} user={user} />
    </div>
  );
}