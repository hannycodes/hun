# Photography

Every photograph in the app lives in `public/images/`. Menu rows and category
cards point at these files from the seed (`supabase/migrations/0004_seed.sql`),
so a picture and a dish name stay together: if you swap a photo, change the seed
row beside it.

## Ethiopian dishes

These three were added for the Ethiopian dishes and are used only where the name
matches what is in the frame.

| File | Used for | Source | Licence |
| :-- | :-- | :-- | :-- |
| `chechebsa.jpg` | Chechebsa (Breakfast) | [Chipchipsa Ethiopian dish 2014](https://commons.wikimedia.org/wiki/File:Chipchipsa_Ethiopian_dish_2014.jpg), Neftalem | CC BY-SA 4.0 |
| `tibs.jpg` | Beef Tibs (Lunch) | [Siga Tibs](https://commons.wikimedia.org/wiki/File:Siga_Tibs.jpg), Khajitdadddy | CC BY-SA 4.0 |
| `buna.jpg` | Sini Buna (Coffee & Tea), hero photograph | [Coffee ceremony of Ethiopia and Eritrea 1](https://commons.wikimedia.org/wiki/File:Coffee_ceremony_of_Ethiopia_and_Eritrea_1.jpg), ProtoplasmaKid | CC BY-SA 4.0 |

CC BY-SA requires attribution: keep this table, or move the credit into the
footer, before the site is published. The share-alike term applies to modified
versions of these three files.

## The rest of the set

`img-01.jpg` … `img-36.jpg` are stock photographs supplied with the project.
Their provenance and licence are not recorded here, and they are placeholders:
replace them with photographs of the actual room and plates before launch, then
delete this paragraph. Until then the seed pairs each one with a dish that is
visibly in the frame — no spinach where chechebsa should be.

## Housekeeping

- Keep images at or below ~1600px on the long edge; the largest file here is
  about 550 KB.
- Square crops are used in the menu grid; portrait crops in the arch shapes.
- Alt text is written where the photograph carries meaning (landing page,
  gallery) and left empty where the dish name already says it (menu rows).
