# Clipping kit

Turns a stream recording into ready-to-post vertical Shorts for pay-per-view
clipping campaigns, with the title and thumbnail rules to post them.

Research date: 2026-11-19. Campaign rates, caps and rules change daily; the
campaign's own page is the only number to trust.

## 1. One-time setup (about 30 minutes, needs your login)

1. Create a YouTube channel named for GTA 6 clips. Verify your phone number
   in YouTube Studio so you can upload from desktop.
2. Sign up at contentrewards.com, link the channel, and add a payout method.
3. Join **KreekCraft GTA 6 Clipping** ($1.00 per 1,000 views, $2 minimum,
   $400 cap, his stream overlay must be visible) and **TOMO GTA VI Clipping**
   ($1.50 per 1,000 views, $3.50 minimum, $150 cap, small budget).
4. Read each brief twice. Download the source file or VOD the campaign gives
   you; only clip footage the campaign authorizes.
5. On the computer that will make clips: install Python 3 and ffmpeg. For
   burned-in captions also run `pip install faster-whisper`.

## 2. Make clips

```
python3 clipper.py stream.mp4 --count 5 --disclosure "#ad" --hashtags "#KreekCraft #GTA6"
```

The script scores every second of audio and cuts the loudest moments
(shouting, laughing, chaos), keeping 8 seconds of build-up before each one.
Output goes to `clips/`:

- `clip_01.mp4` ... 1080x1920, 35 seconds
- `clip_01.jpg` ... the frame at the peak moment, for the thumbnail
- `posting_sheet.csv` ... one row per clip

Then watch each clip, write a `hook` and `title` for it in the sheet, and
re-render with the hook burned in at the top:

```
python3 clipper.py stream.mp4 --sheet clips/posting_sheet.csv --disclosure "#ad" --captions
```

Options worth knowing:

| Option | Use |
|---|---|
| `--layout fit` (default) | Whole frame over a blurred background. Keeps the streamer's overlay and webcam visible, which KreekCraft's campaign requires. |
| `--layout crop` | Fills the screen and cuts off the sides. Only when the brief does not need the overlay. |
| `--length 35` | 20 to 45 seconds suits most moments. Keep under 60: Shorts over a minute with claimed content get blocked. |
| `--captions` | Three-word captions. Not tested in the build environment (the speech model could not be downloaded there); check the first clip before posting. |

Loudness finds candidates, not winners. Delete any clip where nothing
actually happens.

## 3. Titles

Keep titles 20 to 60 characters, name the streamer, and say what happens
without giving away the ending. No fake claims: a title the clip does not
deliver hurts retention and can get the clip rejected.

Fill in the blanks from what you see in the clip:

1. `[Streamer] did NOT expect this in GTA 6`
2. `[Streamer]'s first 5-star chase goes wrong`
3. `[Streamer] finds out what happens when you [action]`
4. `GTA 6 cops are smarter than [Streamer] thought`
5. `[Streamer] can't stop laughing at this GTA 6 glitch`
6. `[Streamer] loses everything in 10 seconds`
7. `The GTA 6 detail that broke [Streamer]`
8. `[Streamer] tries [thing] in GTA 6. Bad idea.`
9. `[Streamer] vs the Vice City police`
10. `Nobody warned [Streamer] about [place/NPC]`

On-screen hook (the `hook` column): the same idea in 4 to 8 words, shown from
the first frame. The first two seconds decide whether the viewer stays.

Hashtags: one or two in the title, at most. Put the campaign's required tag
first (for example `#DylanPage`), then `#GTA6`. Off-topic tags break
YouTube's spam policy.

Description template:

```
[Streamer] playing GTA 6. Full stream on his channel: [link from the brief]
#ad [required hashtag] #GTA6
```

## 4. Thumbnails

- Shorts thumbnails do not show in the Shorts feed, where most views come
  from. They show on your channel page, in search and on the home page.
  Spend one minute per clip on them, not ten.
- Every account can pick a frame: in the mobile app, tap the pencil on the
  upload details screen and choose a frame. Use the time in the sheet's
  `thumb_at_sec` column, or pick the nearest frame with a face reacting.
- Uploading a custom image (9:16, JPG or PNG) is only offered to some
  accounts, mainly YouTube Partner Program channels. If Studio shows an
  upload button, use `clip_NN.jpg`.
- A good frame has one clear subject, the streamer's face or the action at
  its peak, and the hook text readable. Avoid frames that are mid-blur, dark
  or a loading screen.
- The thumbnail must match the clip. Misleading thumbnails can earn a strike.

## 5. Post and submit (each clip)

1. Upload the .mp4 as a Short with the title and description from the sheet.
2. Pick the thumbnail frame.
3. Submit the link in Content Rewards within 30 minutes of posting.
4. Paste the link into `posted_url` and mark `submitted`.

Post 3 to 5 clips a day, spaced a few hours apart. Each clip must be a
different moment; near-duplicate uploads get rejected by campaigns and
down-ranked by YouTube.

## 6. Rules that cost money when broken

- Buying views or using bots is a permanent ban.
- A clip that breaks one line of the brief is paid nothing, even after it
  gets views.
- Some campaigns ban AI-generated videos. Using this script to find and cut
  real moments is editing, not generation, but ask in the campaign's Discord
  if the brief is unclear.
- The game footage belongs to Rockstar, whose policy tolerates only
  non-commercial use and allows takedowns at any time. Do not post story
  spoilers or isolated cutscenes.
- Views under a campaign's minimum pay nothing; views past the cap pay
  nothing. Several clips at 20,000 views beat one at a million.
