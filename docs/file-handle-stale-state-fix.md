# File Handle Stale State Error Fix

## Issue Description

**Error Message:**
```
InvalidStateError: An operation that depends on state cached in an interface object was made but the state had changed since it was read from disk.
```

**User Impact:**
- Processing failed with cryptic error message
- Affected file became inaccessible after error
- Required reloading the application or re-selecting files

## Root Cause

The File System Access API caches file metadata in `FileSystemFileHandle` objects. When time passes or files are modified externally between when the handle is obtained and when a write operation is attempted, the browser detects the stale state and throws `InvalidStateError`.

**Specific Flow:**
1. User selects input directory → `FileSystemFileHandle` objects created for each file
2. User performs analysis (time passes, potential external modifications)
3. User proceeds to processing step
4. In overwrite mode, code attempts `file.handle.createWritable()`
5. Browser detects stale cached state → throws `InvalidStateError`
6. File becomes inaccessible (corrupted handle state)

**Affected Code:**
- `ProcessingView.tsx:191` - Overwrite mode using stale `file.handle`
- `useFileSystem.ts:145` - `saveImageData()` calling `createWritable()` on stale handle

## Solution

### 1. New Method: `saveImageToDirectorySafe()`
Created a new save method that:
- Re-acquires fresh file handle from directory immediately before writing
- Implements retry logic with handle re-acquisition on `InvalidStateError`
- Ensures atomic writes to prevent file corruption
- Provides better error messages for user-facing issues

### 2. Updated Overwrite Mode
Changed `ProcessingView.tsx` to use `saveImageToDirectorySafe()` instead of `saveImageData()` when in overwrite mode:
```typescript
// Before (stale handle risk):
await saveImageData(imageData, file.handle, format);

// After (fresh handle guaranteed):
await saveImageToDirectorySafe(imageData, inputDir, outputFileName, format);
```

### 3. Enhanced Error Handling
Added user-friendly error messages for common File System Access API errors:
- `InvalidStateError` → "File state error - the file may have been modified externally..."
- `NotAllowedError` → "Permission denied..."
- `NotFoundError` → "File not found..."

## Testing

### Manual Test Cases

#### Test Case 1: Time Delay
1. Select input directory with images
2. Run analysis
3. **Wait 5+ minutes** (or modify a file externally)
4. Process images in overwrite mode
5. **Expected:** Processing succeeds without InvalidStateError

#### Test Case 2: External Modification
1. Select input directory
2. Run analysis
3. Open one of the images in another program and save it
4. Process images in overwrite mode
5. **Expected:** Processing handles the modified file gracefully

#### Test Case 3: Large Batch
1. Select directory with 50+ images
2. Run analysis
3. Immediately process in overwrite mode
4. **Expected:** All files process successfully

#### Test Case 4: Permission Revocation
1. Start processing
2. Revoke file access permission during processing
3. **Expected:** Clear error message about permission denied

### Verification
- No `InvalidStateError` in browser console
- All files remain accessible after processing
- User sees helpful error messages for failures
- Processing completes successfully in overwrite mode

## Files Changed

1. `src/hooks/useFileSystem.ts`
   - Added `saveImageToDirectorySafe()` method with retry logic
   - Updated `saveImageData()` with better error handling
   - Added comprehensive documentation

2. `src/components/ProcessingView.tsx`
   - Changed overwrite mode to use `saveImageToDirectorySafe()`
   - Added user-friendly error message mapping
   - Improved error logging

## Prevention

The fix prevents file corruption by:
1. **Always using fresh handles** when writing in overwrite mode
2. **Retry logic** with handle re-acquisition on transient errors
3. **Atomic writes** via `createWritable()` → `write()` → `close()` sequence
4. **Graceful degradation** with clear error messages for user action

## Browser Compatibility

File System Access API support:
- ✅ Chrome/Edge 86+
- ✅ Safari 15.2+
- ❌ Firefox (requires flag)

The fix works on all browsers that support the File System Access API.
