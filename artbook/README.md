# Art book for Kobo

Turns a folder of drawings into a Kobo book, and rebuilds it whenever art is added.

## Adding new art

1. Put the new photos or exports in `inbox/`.
2. `python3 artbook.py add` — files each one in `originals/`, gives it an ID, and
   leaves out anything already in the book (exact copies, crops, rotated re-photos).
3. Open `catalog.csv` and fill in the new rows (see below).
4. `python3 artbook.py sheet` — makes `build/contact-sheet.jpg` to check the crops.
5. `python3 artbook.py build` — uses the `chapter` and `order` columns. `--sort date`, `style` or `medium` makes automatic chapters instead.
6. Copy the `.fxl.kepub.epub` from `build/` to the Kobo over USB.

There is one book, `build/Art & Drawings.fxl.kepub.epub`. `--sort` decides its chapters
(years, styles or mediums). Every page is a full-screen picture with the caption
drawn in, so the Kobo shows it exactly as built. Black-and-white work is sent as
greyscale; colour work gets extra saturation and contrast for colour e-ink
(`color_boost` and `contrast_boost` in `book.json`).

## catalog.csv columns

| column | meaning |
|---|---|
| title | shown under the piece |
| date | `2024`, `2024-05` or `2024-05-17`; blank = undated |
| date_source | `signed`, `photo` (date the photo was taken) or `guess` |
| medium, style | free text; pieces with the same text are grouped together |
| crop | `left,top,right,bottom` in percent of the photo, e.g. `5,5,91,96` |
| rotate | degrees clockwise: `90`, `180`, `270` |
| enhance | `paper` turns grey or yellow paper back to white |
| include | `no` leaves a piece out without deleting it |
| chapter | chapter the piece sits in, e.g. `Paintings` |
| order | position in the book (1, 2, 3...); chapters follow their first piece |
| cover | `yes` on the one piece used for the cover |
| duplicate_of | ID of the piece this is a repeat of |

`book.json` holds the title, author and Kobo screen size. Set `"grayscale": true`
for a black-and-white Kobo.

Needs Python with `pillow`, `numpy` and `opencv-python-headless`.

## Prompt for a new Claude session

> This folder is my art book kit; read README.md. I've added new drawings to inbox/.
> Run `add`, then look at each new piece and fill in its catalog row: title, date
> (read the signature first, it is usually M-YY beside the "A"), medium, style
> (reuse the existing labels), and a crop that trims everything outside the paper.
> Show me the contact sheet, then build the book sorted by date.
