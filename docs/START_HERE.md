# UPDATE YOUR DOCUMENTATION - STEP BY STEP

## FILES YOU NEED TO DOWNLOAD (6 files):

1. **RACE_PARTICIPANTS_FIX.md** (NEW FILE - 7KB)
2. **IMMEDIATE_ACTION_ITEMS.md** (UPDATED)
3. **QUICK_REFERENCE.md** (UPDATED)
4. **MANA_RUNNING_PROJECT_SUMMARY.md** (UPDATED)
5. **schema-changelog.md** (UPDATED)
6. **DOCUMENTATION_INDEX.md** (UPDATED)

---

## STEP 1: DOWNLOAD FILES

Download all 6 files above from this Claude chat. They should appear as download links below this message.

---

## STEP 2: REPLACE FILES ON YOUR COMPUTER

On your computer:

1. **Find your mana-running folder**
   - Should be at: `Desktop/mana-running` or wherever you cloned it

2. **Go to the docs subfolder**
   - Path: `mana-running/docs/`

3. **Replace these 5 files with the downloaded versions:**
   - IMMEDIATE_ACTION_ITEMS.md
   - QUICK_REFERENCE.md
   - MANA_RUNNING_PROJECT_SUMMARY.md
   - schema-changelog.md
   - DOCUMENTATION_INDEX.md

4. **Add this NEW file to the docs folder:**
   - RACE_PARTICIPANTS_FIX.md

---

## STEP 3: COMMIT TO GIT

Open Terminal (Mac) or Command Prompt (Windows):

```bash
# Navigate to your mana-running folder
cd Desktop/mana-running
# Or wherever your folder is: cd path/to/mana-running

# Check what changed
git status

# Add all changes
git add docs/

# Commit
git commit -m "docs: update with race participants fix and course relationships"

# Push to GitHub
git push origin main
```

---

## STEP 4: VERIFY ON GITHUB

Go to: https://github.com/ron681/mana-running/tree/main/docs

You should see:
- 6 updated files with today's date (October 7, 2025)
- New file: RACE_PARTICIPANTS_FIX.md

---

## IF YOU DON'T HAVE GIT SET UP

Just save the files to your docs folder. You can commit them to GitHub later when you have time.

The important thing is having the updated documentation on your computer, especially **RACE_PARTICIPANTS_FIX.md** which has the critical SQL fix you need to run in Supabase.

---

## WHAT'S NEXT (CRITICAL)

After updating docs, immediately go to:
**RACE_PARTICIPANTS_FIX.md** 

Run the SQL in Steps 1 and 2 in your Supabase SQL Editor to fix the race participant count issue.

This is the #1 priority right now.
