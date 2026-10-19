# Chores, at any size of day

Chores that print where you already look. For one person, or a household that shares a home. A list for today, a grid for the week or the month, and room for the days when "done" means a small version. Nothing here counts anything or keeps score.

## What you get

| Block | What it does |
| --- | --- |
| **Chores today** | Today's chores as a tick list on the day page. The ones coming up are marked first, then the daily ones. Spare lines are yours to write in |
| **Chore rotation** | A grid for a week (Monday to Sunday) or a month. Daily, weekly, monthly and seasonal chores, each with the boxes it needs. Add a household and every chore gets a box for each person |

Find both under **Chores** in the block palette. There are four ready-made ones too: Low-energy chores, Week of chores, Month of chores and Household week.

## Put your chores in

The chores are yours, so they live in your profile, never in the code. Open `journal/content/profile.json` and add a `chores` section. Until you do, the blocks draw a made-up sample so you can see how they look.

    "chores": {
      "household": ["Alex", "Sam"],
      "items": [
        { "id": "dishes", "name": "Dishes", "every": "day",
          "min": "Rinse what is in the sink", "ok": "Everything in the dishwasher" },
        { "id": "bathroom", "name": "Bathroom", "every": "week", "day": "fri", "who": "rotate" },
        { "id": "fridge", "name": "Fridge clear-out", "every": "month", "day": 1 },
        { "id": "windows", "name": "Wash the windows", "every": "season", "months": [4, 10] }
      ]
    }

Leave out `household` if it is just you. Each chore needs an `id` (lowercase, digits, dashes), a `name` (up to 28 characters) and how often it comes round (`every`):

| every | You say | It shows up |
| --- | --- | --- |
| `day` | optionally `days`: `["mon", "wed", "fri"]` | Every day, or on those days |
| `week` | `day`: `"sat"`, or leave it out for any day of the week | Three days before that day (the whole week if you gave no day) |
| `month` | `day`: 1 to 28, or `"last"` | Five days before that day |
| `season` | `months`: `[3, 6, 9, 12]` (the default) and `day` | A week before that day, in those months |

`lead` changes how many days before the due day a chore starts to show. If the profile has a mistake, the build stops and says which chore and what to fix.

## Small days

Some days the whole chore is too much. Give a chore two other sizes and any of them counts:

- `min`: the small version. "Rinse what is in the sink."
- `ok`: the good-enough version. "Everything in the dishwasher or drying."

On a Chores today block, **Energy versions** has two settings. *Show the small and the good enough version* prints both under the chore. *Three marks* swaps the box for a quarter, a half and a whole circle: small, good enough, all of it. Fill in whichever you did. You write the wording; nothing is written for you.

## "Due soon"

A chore that is coming up gets a small open diamond and the word "soon" on the day it is due and the day before. That is all. There is no red, no count of what is left and no streak, because the page cannot know what you did and would not say it if it could. A chore that is not on today's list is not late: it just is not today's. You can switch the marker off on any block.

## Sharing a home

Turn on **Household** and each chore gets a box for each person, with a short line saying which letter is whom. A chore marked `"who": "rotate"` goes to the next person each time it comes round and stays with one person for the whole week it shows. Their box is drawn a little heavier. You can also give a chore to one person with `"who": "Alex"`.

## Make a rotation page

A rotation page is a Collection page (or a blank page) with a Chore rotation block on it. In the page organiser, add a Collection page, choose **Edit blocks**, add *Week of chores* or *Month of chores* from the palette and give it the room it asks for. On a day page it shows that week's chores, with the days named. On any other page it is a template: the chores that repeat every week, and for a month the weekly, monthly and seasonal ones, with the months a seasonal chore belongs to written next to it.

In a month grid, W1 to W5 mean days 1 to 7, 8 to 14, 15 to 21, 22 to 28 and 29 on, so the page does not need a calendar.

## Good to know

- **Paper only for now.** The X4 does not show chores yet. The plan (a list on the device, ticks sent only when you start a sync) is in the build plan, section 24.
- **Private.** The block's settings (how many lines, which kinds, whether to show household boxes) go into a saved version of your book. Your chores and your household's names do not.
- **Print.** Marks are drawn, not typed, so the book passes the KDP font check. Large print and high contrast work with both blocks.
