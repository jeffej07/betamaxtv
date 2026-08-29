# BetamaxTV

## Run it locally

```bash
npm install
npm run dev
```

Opens at http://localhost:5173

## Before it will actually work: set Firestore rules

You created the Firestore database in "production mode," which blocks all
reads/writes by default. Go to **Firebase Console → Firestore Database →
Rules** and replace the contents with this, then click **Publish**:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }

    match /comments/{commentId} {
      allow read: if true;
      allow create: if request.resource.data.keys().hasAll(['titleId', 'name', 'text', 'createdAt'])
                    && request.resource.data.titleId is int
                    && request.resource.data.name is string
                    && request.resource.data.name.size() <= 60
                    && request.resource.data.text is string
                    && request.resource.data.text.size() > 0
                    && request.resource.data.text.size() <= 1000;
      allow update, delete: if false;
    }
  }
}
```

This lets a signed-in user read and write **only their own** profile
document (username, favorite genre, favorite show) — nobody can read or
edit anyone else's data.

The second block is new: it's what makes video comments permanent (see
"Comments now save for real" below). Anyone can **read** comments (so
they show up for every visitor), anyone can **create** one as long as it
has the right shape and isn't empty/oversized, and nobody can edit or
delete someone else's comment after the fact.

> **You don't need to manually create a "comments" collection anywhere
> in the Firebase Console.** Firestore creates a collection automatically
> the first time the app writes a document into it — that's the
> "workaround" for adding new collections. You only ever need to touch
> the Console for **Rules**, exactly like above.

If you'd rather require people to be signed in before they can comment
(instead of allowing guest comments, which is the current behavior),
change the `allow create` line to also require
`request.auth != null &&`.

## Deploying to GitHub Pages

1. Create a new GitHub repo (e.g. `betamaxtv`) and push this project to it.
2. In `vite.config.js`, make sure `base` matches your repo name exactly:
   `base: "/betamaxtv/"` (already set — change it if you rename the repo).
3. Install the deploy helper (already in package.json) and run:
   ```bash
   npm run build
   npm run deploy
   ```
   This builds the site and pushes it to a `gh-pages` branch.
4. In your repo on GitHub: **Settings → Pages → Source**, choose the
   `gh-pages` branch, and save. Your site will be live at
   `https://yourusername.github.io/betamaxtv/` within a minute or two.

## What's real now vs. what's still simulated

- **Real:** account creation, login, logout, and session persistence —
  all via Firebase Authentication. Profile fields (username, favorite
  genre, favorite show) are stored in Firestore. New signups also get a
  real **email verification link** sent automatically via Firebase.
  **Video comments are now real too** — see below.
- **Still simulated (client-side only, resets on refresh):** the "weekly
  popular" FOMO toasts, the live chat's other participants, and the "X
  watching along" counter. None of these talk to a real backend yet —
  they're fake activity to make the site feel alive.
- **Not implemented:** actual video file hosting/streaming. You'll want
  a real video host (Bunny.net, Mux, Vimeo private embeds, etc.) before
  this is a functioning streaming service — GitHub Pages and Firebase's
  free tier are not built for serving large video files.

## Comments now save for real

Comments live in a Firestore collection called `comments` (see the Rules
section above). Each comment is one document with `titleId`, `name`,
`text`, and a server-generated timestamp. The Detail page for a title
subscribes to its comments live, so:

- Comments survive a page refresh.
- If two people have the title open at once, they see each other's new
  comments show up without reloading.
- Nothing extra to set up beyond publishing the Rules above — the app
  handles writing/reading the collection itself.

## Adding new titles (thumbnails, tags, and rating badges made easy)

Everything about the catalog now lives in one place near the top of
`src/App.jsx`: the `TITLES` array. Each title is a plain object with
named fields instead of a fragile position-counted list, so adding your
next 30+ titles is copy/paste/edit:

```js
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
  embed: "",                // optional per-title video URL; blank uses the default demo embed
},
```

**1. Thumbnails, decoupled from the title text.** Drop your image
anywhere in `public/posters/` and put its exact filename in `poster`
(e.g. `poster: "my-movie-2026.jpg"`). It no longer has to match a
slugified version of the title — name your files however you like. If
you leave `poster` blank, it still falls back to the old
title-based-filename behavior automatically.

**2. Genre/category/year/country/quality tags.** The badges you see on
the card and detail page (e.g. "Movie · Drama · 2026 · Thailand · HD")
are generated automatically from `type`, `category`, `year`, `language`,
and `quality`. Change any of those fields and the tags update — nothing
else to touch. The filter chips in Advanced Search (Category, Genre,
Language, Quality) also rebuild themselves from whatever values exist
across your titles, so a brand-new category or country you type in will
just show up as a filter option on its own.

**3. Rating badges, toggled independently per title.** Every title has
two independent on/off switches:
- `showRt: true/false` — show/hide the Rotten-Tomatoes-style badge
- `showImdb: true/false` — show/hide the IMDb badge

Set whichever ones apply — both, one, or neither. There's no more
special-cased title in the code; every title is controlled the same way.

## Customizing the verification email

By default Firebase sends its own plain template from
`noreply@betamaxtv-9132a.firebaseapp.com`. To customize the subject,
message, and sender name: Firebase Console → Authentication →
Templates → "Email address verification" → click the pencil icon to
edit. A custom "from" domain (e.g. `noreply@betamaxtv.com`) requires
verifying domain ownership and is only available on the paid Blaze
plan — the default sender works fine for free.

