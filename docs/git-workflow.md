# Bulletproof Git Workflow

## Before Making Any Changes

### 1. Check Where You Are
```bash
pwd                          # Confirm you're in the right directory
git status                   # See current branch and file status
git branch                   # List all branches (current has *)
```

### 2. Always Start Clean
```bash
git status                   # Should show "working tree clean"
git pull origin $(git branch --show-current)  # Pull latest changes
```

## Making Changes

### 3. Make Your Changes
- Edit files in your IDE
- **Save all files** (Cmd+S / Ctrl+S)

### 4. The Sacred Commit Process
```bash
# Step 1: See what changed
git status                   # RED = unstaged, GREEN = staged

# Step 2: Add files (choose one method)
git add .                    # Add all changes
# OR
git add specific-file.tsx    # Add specific files

# Step 3: Verify what will be committed
git status                   # Should show GREEN files
git diff --cached           # See exactly what will be committed

# Step 4: Commit with clear message
git commit -m "Clear description of what you changed"

# Step 5: Verify the commit happened
git log --oneline -n 2      # Should show your new commit at top
```

### 5. The Sacred Push Process
```bash
# Step 1: Push and WATCH for errors
git push origin $(git branch --show-current)

# Step 2: Verify push succeeded
git status                   # Should say "up to date with origin/..."

# Step 3: Get the GitHub URL to verify
echo "Check: https://github.com/miggitty/transformo3/blob/$(git branch --show-current)/app/(app)/content/page.tsx"
```

## Verification Checklist

### 6. Triple-Check System
1. **Local File**: Open the file and confirm your changes are there
2. **Git Commit**: Run `git show HEAD:path/to/file.tsx | grep "your change"`
3. **GitHub**: Open the URL from step 5 and hard-refresh (Cmd+Shift+R)
4. **Live Site**: Check the deployed site (may take 2-3 minutes)

## Emergency Commands

### If Things Go Wrong
```bash
# See exactly what's different between local and GitHub
git fetch
git diff HEAD origin/$(git branch --show-current)

# Force push (ONLY if you're sure)
git push origin $(git branch --show-current) --force

# See detailed push logs
git push origin $(git branch --show-current) --verbose
```

### If GitHub Shows Old Content
1. **Hard refresh**: Cmd+Shift+R (Mac) or Ctrl+Shift+R (Windows)
2. **Try incognito mode**
3. **Check the branch dropdown** on GitHub (make sure you're on the right branch)
4. **Wait 30 seconds** (GitHub sometimes has delay)

## Prevention Rules

### Never Skip These Steps:
1. **Always run `git status` before and after each command**
2. **Always verify the commit with `git log --oneline -n 2`**
3. **Always watch the push output for errors**
4. **Always hard-refresh GitHub after pushing**
5. **Always check you're on the right branch BEFORE making changes**

### Common Mistakes to Avoid:
- ❌ Making changes without checking current branch
- ❌ Forgetting to save files before committing
- ❌ Not reading push error messages
- ❌ Looking at wrong branch on GitHub
- ❌ Not staging files with `git add`
- ❌ Assuming push worked without verification 