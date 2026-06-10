# Manual API runner: http://localhost:5173/test-case
#
# Each purchase and sale also runs two follow-up steps:
#   a) GET invoice/order
#   b) PATCH edit — qty reduced by 1 (e.g. 40 → 39)
# Purchase returns and sales returns: create + GET only (no edit).
# Expected qty in the UI is recomputed from qty ledger deltas.
#
| #  | Transaction                  | Expected Qty |
| -- | ---------------------------- | -----------: |
| 1  | Purchase 100 @ 100           |          100 |
| 2  | Purchase 50 @ 120            |          150 |
| 3  | Sale 40                      |          110 |
| 4  | Purchase 60 @ 150            |          170 |
| 5  | Purchase Return 20 @ 150     |          150 |
| 6  | Sale 30                      |          120 |
| 7  | Sales Return 10 (from #6)    |          130 |
| 8  | Purchase 100 @ 200           |          230 |
| 9  | Sale 50                      |          180 |
| 10 | Delete #5 Purchase Return    |          200 |
| 11 | Purchase 80 @ 180            |          280 |
| 12 | Sale 70                      |          210 |
| 13 | Purchase Return 10 @ 180     |          200 |
| 14 | Sales Return 5 (from #12)    |          205 |
| 15 | Delete #7 Sales Return       |          195 |
| 16 | Purchase 40 @ 250            |          235 |
| 17 | Sale 25                      |          210 |
| 18 | Purchase 75 @ 300            |          285 |
| 19 | Sale 60                      |          225 |
| 20 | Delete #2 Purchase 50 @ 120  |          175 |
| 21 | Purchase Return 15 @ 300     |          160 |
| 22 | Sales Return 20 (from #19)   |          180 |
| 23 | Purchase 30 @ 350            |          210 |
| 24 | Sale 40                      |          170 |
| 25 | Purchase 50 @ 400            |          220 |
| 26 | Delete #13 Purchase Return   |          230 |
| 27 | Sale 35                      |          195 |
| 28 | Purchase Return 5 @ 400      |          190 |
| 29 | Sales Return 10 (from #27)   |          200 |
| 30 | Delete #24 Sale 40           |          240 |
| 31 | Delete #29 Sales Return      |          230 |
| 32 | Delete #18 Purchase 75 @ 300 |          155 |
|
| Bulk (same customer user) — cases #33–#60, qty 1 each, no edit sub-steps |
| 33 | Bulk sale 1/28 |          154 |
| … | … | … |
| 60 | Bulk sale 28/28 |          127 |
