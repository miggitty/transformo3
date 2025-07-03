# NEVER-FAIL DEPLOYMENT WORKFLOW

## 🎯 BEGINNER'S COMPLETE STEP-BY-STEP GUIDE

### The Three-Stage Rocket: Development → Staging → Production

**This is your sacred workflow. Follow it religiously and you'll never have sync issues again.**

---

## 🚀 STAGE 1: Making Changes (Development Branch)

### Step 1A: Start with Clean Development Branch
1. **Open GitHub Desktop**
2. **Top-left dropdown**: Switch to `development` branch
3. **Top-right**: Click "Fetch origin" button
4. **Wait for it to complete**
5. **If you see "Pull origin"**: Click it to get latest changes

### Step 1B: Make Your Changes
1. **Open your code editor** (VS Code/Cursor)
2. **Make your changes** (edit files)
3. **Save ALL files** (Cmd+S on Mac, Ctrl+S on Windows)
4. **Don't close your editor yet**

### Step 1C: Commit Changes to Development
1. **Switch to GitHub Desktop**
2. **Left sidebar**: You should see your changed files with blue dots
3. **Click on each file**: Review the red/green changes in right panel
4. **Bottom-left**: Write a clear commit message (e.g., "Update content list to 270")
5. **Click "Commit to development"**
6. **Top bar should show "Push origin"**: Click it
7. **Wait for success**: Button changes back to "Fetch origin"

### Step 1D: Verify Development is Updated
1. **Open browser**: Go to `https://github.com/miggitty/transformo3`
2. **Make sure**: Branch dropdown shows "development"
3. **Navigate to your file**: `app/(app)/content/page.tsx`
4. **Hard refresh**: Cmd+Shift+R (Mac) or Ctrl+Shift+R (Windows)
5. **Verify**: Your changes are visible in the file

---

## 🎯 STAGE 2: Deploy to Staging

### Step 2A: Check if Staging Needs Updating
1. **Stay on GitHub.com**: `https://github.com/miggitty/transformo3`
2. **Click branch dropdown**: Select "staging"
3. **Look for notification**: 
   - ✅ "This branch is up to date with development" = You can skip to Step 2D
   - ❌ "This branch is X commits behind development" = Continue to Step 2B

### Step 2B: Sync Development → Staging
1. **Click "Contribute" button** (next to the "behind" notification)
2. **Click "Open pull request"**
3. **Verify direction**: Should say **base: staging ← compare: development**
4. **Scroll down**: Review the file changes in the diff
5. **Verify**: Your latest changes are shown in green
6. **Title**: Leave as-is or write "Sync development to staging"
7. **Click "Create pull request"**

### Step 2C: Merge the PR
1. **Click "Merge pull request"** (green button)
2. **Click "Confirm merge"**
3. **You'll see**: "Pull request successfully merged and closed"

### Step 2D: Verify Staging is Synced
1. **Click "staging" branch** (if not already there)
2. **Should now say**: "This branch is up to date with development" ✅
3. **Navigate to your file**: `app/(app)/content/page.tsx`
4. **Hard refresh**: Cmd+Shift+R
5. **Verify**: Your changes are visible

### Step 2E: Watch Staging Deploy
1. **Click "Actions" tab** at top of GitHub
2. **You should see**: "Deploy Staging" workflow running (yellow dot)
3. **Wait 2-3 minutes**: For green checkmark
4. **Open staging site**: `https://staging3.transformo.io/content`
5. **Hard refresh**: Your changes should be live!

---

## 🏆 STAGE 3: Deploy to Production

### Step 3A: Check if Main Needs Updating
1. **Go back to GitHub**: `https://github.com/miggitty/transformo3`
2. **Click branch dropdown**: Select "main"
3. **Look for notification**:
   - ✅ "This branch is up to date with staging" = Skip to Step 3D
   - ❌ "This branch is X commits behind staging" = Continue to Step 3B

### Step 3B: Sync Staging → Main (Production)
1. **Click "Contribute" button**
2. **Click "Open pull request"**
3. **Verify direction**: Should say **base: main ← compare: staging**
4. **Review changes**: Scroll down to see diff
5. **Verify**: Your changes are included
6. **Title**: "Deploy staging to production" or similar
7. **Click "Create pull request"**

### Step 3C: Merge to Production
1. **Click "Merge pull request"** (green button)
2. **Click "Confirm merge"**
3. **Success message appears**

### Step 3D: Verify Production Deploy
1. **Click "Actions" tab**
2. **You should see**: "Deploy Production" workflow running
3. **Wait 2-3 minutes**: For completion
4. **Open production site**: `https://transformo.io/content` (or your live URL)
5. **Hard refresh**: Your changes should be live!

---

## 📋 QUICK REFERENCE CHECKLIST

### Before Starting:
- [ ] GitHub Desktop shows correct repository
- [ ] You're on `development` branch
- [ ] Click "Fetch origin" to get latest

### For Each Change:
- [ ] Make changes in your editor
- [ ] Save all files (Cmd+S)
- [ ] Commit in GitHub Desktop
- [ ] Push to development
- [ ] Verify on GitHub.com

### Development → Staging:
- [ ] Check if staging is behind development
- [ ] If behind: Create PR development → staging
- [ ] Merge the PR
- [ ] Wait for GitHub Actions to deploy
- [ ] Verify on staging site

### Staging → Production:
- [ ] Check if main is behind staging  
- [ ] If behind: Create PR staging → main
- [ ] Merge the PR
- [ ] Wait for GitHub Actions to deploy
- [ ] Verify on production site

---

## 🚨 RED FLAGS - STOP AND FIX

### ❌ Don't Continue If:
- Files don't appear in GitHub Desktop after saving
- GitHub.com doesn't show your changes after pushing
- Branch says "X commits behind" but you skip syncing
- GitHub Actions shows red X (failed)
- Live site doesn't show changes after 5 minutes

### 🔧 Quick Fixes:
- **Files don't appear**: Save files again, click Repository → Refresh in GitHub Desktop
- **Changes not on GitHub**: Check you pushed successfully, look for "Fetch origin" button
- **Behind branches**: Always create and merge the PR to sync
- **Failed Actions**: Check Actions tab for error details
- **Changes not live**: Hard refresh browser, wait another few minutes

---

## 💡 PRO TIPS

### Speed Up Your Workflow:
1. **Bookmark these URLs**:
   - `https://github.com/miggitty/transformo3/compare/staging...development` (dev→staging PR)
   - `https://github.com/miggitty/transformo3/compare/main...staging` (staging→production PR)

2. **Use GitHub Desktop shortcuts**:
   - Cmd+1: Changes tab
   - Cmd+2: History tab  
   - Cmd+Enter: Commit
   - Cmd+P: Push

3. **Always hard refresh**: Cmd+Shift+R after any deployment

### When Things Go Wrong:
1. **Take a screenshot** of the error
2. **Check GitHub Actions logs** for details
3. **Use the emergency commands** from the bottom of this guide

---

## The Problem You Keep Having

Your deployment system works perfectly. The issue is **branch sync problems**:
- Development has your latest changes 
- Staging branch gets out of sync
- You deploy old staging code and think deployment is broken

## The Solution: Sacred Workflow Rules

### Rule 1: ALWAYS Check Branch Status Before Deploying

**In GitHub Desktop (Before Any Deployment):**
1. **Switch to development branch** (top-left dropdown)
2. **Click "Fetch origin"** to get latest
3. **Note your latest changes** are there
4. **Switch to staging branch** (top-left dropdown) 
5. **Check if staging is behind** (will show "X commits behind development")

### Rule 2: ALWAYS Sync Staging Before Deploying

**If Staging is Behind Development:**

**Option A: Use GitHub (Recommended)**
1. Go to GitHub.com → your repo
2. Click **"Compare & pull request"** (development → staging)
3. **Review the changes** - make sure your latest code is included
4. **Create pull request** and **merge it**
5. **Wait for GitHub Actions** to complete deployment

**Option B: Use Command Line (Advanced)**
```bash
git checkout staging
git merge development  
git push origin staging
```

### Rule 3: NEVER Deploy to Staging Without This Check

**The 30-Second Verification:**
1. **GitHub Desktop**: staging branch shows same commits as development ✅
2. **GitHub.com**: staging branch file shows your latest changes ✅  
3. **Only then**: Let GitHub Actions deploy ✅

## Your Sacred Development→Staging Process

### Step 1: Make Changes on Development
- Edit files in your IDE
- Save all files (Cmd+S)
- Use GitHub Desktop to commit and push to development

### Step 2: Verify Development is Updated  
- GitHub Desktop: development branch has your commit
- GitHub.com: development branch shows your changes
- Your changes work locally

### Step 3: Sync Staging (CRITICAL!)
- **Check**: Is staging behind development?
- **If yes**: Create PR development→staging and merge it
- **Verify**: staging branch now has your latest changes

### Step 4: Deploy Happens Automatically
- GitHub Actions triggers on staging branch update
- Deployment uses correct, current staging code
- Live site shows your changes in 2-3 minutes

## Visual Indicators in GitHub Desktop

### ✅ Safe to Deploy:
- Development and staging show same commits
- No "X commits behind" warnings
- Files show same content in both branches

### ❌ DO NOT Deploy Yet:
- "Staging is X commits behind development"  
- Different commit hashes at top of history
- Files show different content between branches

## Emergency Fix Commands

If you've deployed and the wrong version is live:

```bash
# Check what's actually on staging
git checkout staging
git log --oneline -n 3

# See the difference between development and staging  
git diff development staging

# Force staging to match development (nuclear option)
git checkout staging
git reset --hard development
git push origin staging --force
```

## Automation Ideas to Prevent This

### Option 1: Auto-sync Script
Create a script that automatically merges development→staging:

```bash
#!/bin/bash
echo "Syncing staging with development..."
git checkout development
git pull origin development
git checkout staging  
git merge development
git push origin staging
echo "Staging is now synced!"
```

### Option 2: GitHub Actions Auto-merge
Set up GitHub Actions to automatically merge development→staging when development is updated.

### Option 3: Branch Protection Rules
Set up GitHub branch protection to require staging to be up-to-date before deployments.

## The Real Solution: Discipline

**The only way to stop this permanently:**
1. **Always check branch sync before deploying**
2. **Never assume staging has your latest changes**  
3. **Use the verification steps every single time**
4. **When in doubt, merge development→staging first**

## Quick Verification Command

Add this alias to quickly check if branches are synced:

```bash
alias check-sync='echo "Development:" && git log development --oneline -n 1 && echo "Staging:" && git log staging --oneline -n 1'
```

Run `check-sync` - if the commit hashes are different, staging needs updating.

## Bottom Line

**This will keep happening unless you religiously follow the branch sync workflow.**

The deployment system works perfectly. The issue is deploying old code from an out-of-sync staging branch.

**Fix: Always verify staging has your latest changes before expecting them to deploy.** 