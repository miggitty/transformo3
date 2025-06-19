# GitHub Desktop Bulletproof Workflow

## Before Making Any Changes

### 1. Check Where You Are
- **Current Branch**: Look at top-left corner of GitHub Desktop
- **Current Repository**: Check the dropdown at the very top
- **Branch Status**: Should show "No local changes" in the center panel

### 2. Always Start Fresh
- Click **"Fetch origin"** button (top-right)
- If you see **"Pull origin"**, click it to get latest changes
- Make sure center panel shows **"No local changes"**

## Making Changes

### 3. Make Your Changes in Your Editor
- Edit files in VS Code/Cursor
- **⚠️ CRITICAL: Save all files** (Cmd+S / Ctrl+S)

### 4. The Sacred GitHub Desktop Process

#### Step 1: Verify Changes Appear
- **Look at left sidebar** in GitHub Desktop
- **✅ Your changed files should appear** with blue dots
- **❌ If no files appear**: You didn't save your files!

#### Step 2: Review Changes
- **Click on each file** in the left sidebar
- **Right panel shows red/green diff** - verify this is what you changed
- **✅ If diff looks right**: Continue
- **❌ If diff is wrong**: Go back to editor and save properly

#### Step 3: Commit
- **Bottom-left corner**: Write clear commit message
- **Click "Commit to [branch-name]"** button
- **✅ Left sidebar should clear** (no more files listed)

#### Step 4: Push (Most Critical!)
- **Top bar should show**: "Push origin" or "Push 1 commit to origin"
- **Click "Push origin"** button
- **⚠️ WATCH FOR ERRORS**: If push fails, GitHub Desktop will show red error
- **✅ Success**: Button changes back to "Fetch origin"

## Verification Checklist (Never Skip!)

### 5. Triple-Check in GitHub Desktop
1. **Left sidebar**: Should be empty (no pending changes)
2. **Top bar**: Should show "Fetch origin" (not "Push")
3. **History tab**: Click it and verify your commit is at the top
4. **Branch indicator**: Note which branch you're on

### 6. Verify on GitHub.com
1. **Open browser**: Go to your GitHub repository
2. **Check branch dropdown**: Make sure you're viewing the SAME branch
3. **Navigate to your file**: Find the file you changed
4. **Hard refresh**: Cmd+Shift+R (Mac) or Ctrl+Shift+R (Windows)
5. **✅ Your changes should be visible**

### 7. Verify Live Site (for staging/main)
- Wait 2-3 minutes for deployment
- Check the live site to confirm changes deployed

## Common GitHub Desktop Issues & Solutions

### Issue 1: "No changes detected"
**Problem**: Files don't appear in left sidebar
**Solution**: 
- Save all files in your editor (Cmd+S)
- Click "Repository" → "Refresh" in GitHub Desktop
- Check you're in the right repository (top dropdown)

### Issue 2: "Push failed" or red errors
**Problem**: GitHub Desktop shows push errors
**Solution**:
- Read the error message carefully
- Often means conflicts or authentication issues
- Try: Repository → Pull → then Push again

### Issue 3: GitHub.com shows old content
**Problem**: Your changes aren't on GitHub
**Solutions**:
1. **Wrong branch**: Check branch dropdown on GitHub
2. **Browser cache**: Hard refresh (Cmd+Shift+R)
3. **Push didn't work**: Check GitHub Desktop history tab
4. **Wait**: Sometimes GitHub has 30-second delay

### Issue 4: "Merge conflicts"
**Problem**: GitHub Desktop shows conflict warnings
**Solution**:
- Don't panic! Click "Repository" → "Pull"
- Resolve conflicts in your editor
- Follow GitHub Desktop's conflict resolution flow

## The Never-Fail Checklist

### Before Making Changes:
- [ ] GitHub Desktop shows correct repository (top dropdown)
- [ ] GitHub Desktop shows correct branch (top-left)
- [ ] Click "Fetch origin" to get latest changes
- [ ] Center panel shows "No local changes"

### After Making Changes:
- [ ] Save all files in editor (Cmd+S)
- [ ] Files appear in GitHub Desktop left sidebar
- [ ] Review diffs in right panel (look correct?)
- [ ] Write clear commit message
- [ ] Click "Commit to [branch]"
- [ ] Left sidebar clears (no pending files)
- [ ] Click "Push origin" 
- [ ] Button changes back to "Fetch origin"
- [ ] Check History tab - your commit is at top

### Final Verification:
- [ ] Open GitHub.com
- [ ] Select correct branch
- [ ] Navigate to your file
- [ ] Hard refresh (Cmd+Shift+R)
- [ ] Changes are visible
- [ ] (If staging/main) Check live site in 2-3 minutes

## Pro Tips for GitHub Desktop

### Visual Indicators to Watch:
- **Blue dot** = File has changes
- **Green plus** = New file
- **Red minus** = Deleted file
- **"Fetch origin"** = All synced ✅
- **"Push origin"** = You have unpushed commits ⚠️
- **"Pull origin"** = Remote has new changes ⚠️

### Shortcuts:
- **Cmd+Shift+G** (Mac) = Open GitHub Desktop
- **Cmd+1** = Changes tab
- **Cmd+2** = History tab
- **Cmd+Enter** = Commit
- **Cmd+P** = Push to origin

### Emergency Recovery:
If things go completely wrong:
1. **Repository** → **Open in Terminal**
2. Run: `git status`
3. Take a screenshot and ask for help!

## Branch Management in GitHub Desktop

### Switching Branches:
1. **Click current branch name** (top-left)
2. **Select different branch** from dropdown
3. **Wait for files to update**
4. **Always fetch after switching**

### Creating PRs:
1. **Push your changes** to feature branch
2. **Click "Create Pull Request"** button
3. **Fills out PR form** on GitHub.com
4. **Never merge your own PRs** - always review first 