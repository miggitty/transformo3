# PRD: Scheduling Calendar Final Features

## Overview

This document outlines the implementation of two final features for the existing scheduling calendar in the Content Assets Manager:

1. **Past Date Prevention**: Prevent users from dragging content assets to dates in the past
2. **Batch Scheduling**: Replace instant saves with a "Schedule" button to save all changes at once

## Background

The scheduling calendar is already fully implemented in `components/shared/content-assets-manager.tsx` with:
- FullCalendar integration with drag-drop functionality
- Timezone handling (business timezone ↔ UTC conversion)  
- Asset management and persistence
- Visual event rendering and interactions

**CRITICAL**: All existing architecture, timezone functionality, and database interactions must remain unchanged. Only the two requested features will be added.

## Goals and Objectives

- **Goal 1**: Improve user experience by preventing invalid scheduling to past dates
- **Goal 2**: Provide better control over scheduling changes by allowing bulk saves instead of instant persistence
- **Objective**: Maintain all existing functionality while adding the two new features seamlessly

## Feature Requirements

### Feature 1: Past Date Prevention

#### User Story
As a user, when I try to drag a content asset to a date in the past, I should receive clear feedback that this action is not allowed, and the asset should revert to its original position.

#### Acceptance Criteria
- [ ] When dragging an asset to any date before today, the drag operation is immediately reverted
- [ ] A toast notification appears explaining that scheduling to past dates is not allowed
- [ ] The validation uses the business timezone for date comparison (not UTC)
- [ ] The feature works for both date-only moves and full date+time moves
- [ ] The error feedback is immediate and non-blocking (follows drag-drop UX best practices)

#### Technical Implementation
- Modify `handleEventDrop` function to add date validation as first step
- Compare `event.start` date with current date in business timezone using `toZonedTime`
- Immediately call `info.revert()` for past dates before any other processing
- Show toast error message: "Cannot schedule content to a date in the past"
- Use existing toast system (Sonner) for consistent error messaging

### Feature 2: Batch Scheduling with Schedule Button

#### User Story
As a user, I want to be able to move multiple content assets around the calendar and only save all changes when I click a "Schedule" button, giving me more control over my scheduling decisions.

#### Acceptance Criteria
- [ ] Dragging assets updates the calendar view but does not save to database
- [ ] A "Schedule" button appears at the bottom right of the calendar
- [ ] The button shows the number of pending changes (e.g., "Schedule (3 changes)")
- [ ] Clicking the button saves **only pending changes** to the database (not all scheduled content)
- [ ] Visual indicators distinguish between saved and pending changes (different styling)
- [ ] Button is disabled when there are no pending changes
- [ ] A "Reset Changes" button allows users to undo all pending modifications
- [ ] Navigation warning dialog appears if user tries to leave with unsaved changes
- [ ] No confirmation dialog required before saving (streamlined UX)

#### Technical Implementation
- Add `pendingChanges` state to track unsaved asset moves
- Modify `handleEventDrop` to update local state only (not call `onAssetUpdate`)
- Add visual styling for pending vs saved events (opacity, border, or color differences)
- Create new action `saveBatchScheduleChanges` for bulk database updates of only pending changes
- Add Schedule button component with change counter and disabled state
- Add Reset Changes button to revert pending changes back to saved state
- Implement navigation guard (beforeunload/router events) for unsaved changes warning

## Implementation Plan

### Phase 1: Past Date Prevention
- [ ] Add date validation logic to `handleEventDrop`
- [ ] Implement business timezone date comparison
- [ ] Add toast notification for past date attempts
- [ ] Test edge cases (timezone boundaries, today's date)

### Phase 2: Batch Scheduling State Management  
- [ ] Add `pendingChanges` state to component
- [ ] Modify `handleEventDrop` to store changes locally
- [ ] Update `calendarEvents` to reflect pending changes visually
- [ ] Add visual indicators for pending vs saved events

### Phase 3: Schedule Button Implementation
- [ ] Create Schedule button component with change counter
- [ ] Add Reset Changes button component  
- [ ] Position buttons at bottom right below calendar
- [ ] Implement disabled states when no changes pending
- [ ] Add button styling and loading states

### Phase 4: Batch Save Action
- [ ] Create `saveBatchScheduleChanges` server action for pending changes only
- [ ] Implement bulk database updates with error handling
- [ ] Add optimistic updates and rollback logic
- [ ] Integrate with existing timezone conversion logic

### Phase 5: Navigation Guards and Final Integration
- [ ] Implement navigation warning for unsaved changes
- [ ] Connect Schedule button to batch save action
- [ ] Connect Reset Changes to local state reset
- [ ] Add comprehensive error handling and loading states
- [ ] Test all timezone edge cases and user flows
- [ ] Ensure no regression in existing functionality

## Technical Architecture

### State Management
```typescript
// New state to add to ContentAssetsManager
const [pendingChanges, setPendingChanges] = useState<Map<string, ContentAsset>>(new Map());
const [originalAssets, setOriginalAssets] = useState<Map<string, ContentAsset>>(new Map());
const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
const [isSaving, setIsSaving] = useState(false);

// Initialize original assets map when assets change
useEffect(() => {
  const originalMap = new Map();
  assets.forEach(asset => {
    if (asset.asset_scheduled_at) {
      originalMap.set(asset.id, asset);
    }
  });
  setOriginalAssets(originalMap);
}, [assets]);
```

### Modified Event Drop Handler
```typescript
const handleEventDrop = async (info: any) => {
  // 1. Past date validation (immediate revert + toast)
  const newDate = new Date(info.event.start);
  const today = new Date();
  const todayInBusinessTZ = toZonedTime(today, businessTimezone);
  const newDateInBusinessTZ = toZonedTime(newDate, businessTimezone);
  
  if (newDateInBusinessTZ < todayInBusinessTZ) {
    info.revert();
    toast.error('Cannot schedule content to a date in the past');
    return;
  }
  
  // 2. Store change locally (don't save to DB)
  const asset = assets.find(a => a.id === info.event.extendedProps.assetId);
  if (!asset) return;
  
  // Calculate new datetime with timezone conversion (existing logic)
  const finalDateTime = calculateNewDateTime(info.event.start, asset.asset_scheduled_at, businessTimezone);
  
  const updatedAsset = { ...asset, asset_scheduled_at: finalDateTime };
  setPendingChanges(prev => new Map(prev.set(asset.id, updatedAsset)));
  setHasUnsavedChanges(true);
};
```

### Reset Changes Handler
```typescript
const handleResetChanges = () => {
  setPendingChanges(new Map());
  setHasUnsavedChanges(false);
  toast.success('Changes reset to saved state');
};
```

### Navigation Guard
```typescript
// Add to useEffect
useEffect(() => {
  const handleBeforeUnload = (e: BeforeUnloadEvent) => {
    if (hasUnsavedChanges) {
      e.preventDefault();
      e.returnValue = 'You have unsaved changes. Are you sure you want to leave?';
    }
  };
  
  window.addEventListener('beforeunload', handleBeforeUnload);
  return () => window.removeEventListener('beforeunload', handleBeforeUnload);
}, [hasUnsavedChanges]);
```

### New Server Action
```typescript
export async function saveBatchScheduleChanges({
  changes,
  contentId,
}: {
  changes: Array<{ assetId: string; newDateTime: string }>;
  contentId: string;
}) {
  // Bulk update logic for only the pending changes
  // Uses existing updateAssetSchedule logic per asset
  // Returns success/failure per change for granular error handling
}
```

## Success Criteria

1. ✅ Users cannot drag content to past dates
2. ✅ Clear error messaging for invalid drag attempts  
3. ✅ Calendar shows pending changes visually
4. ✅ Schedule button enables batch saving
5. ✅ All existing functionality preserved
6. ✅ Timezone handling remains unchanged
7. ✅ Performance is not degraded

## Risks and Mitigation

- **Risk**: Breaking existing timezone logic
  - **Mitigation**: Use existing timezone conversion functions without modification
  
- **Risk**: State management complexity with pending changes
  - **Mitigation**: Use Map for efficient lookups and clear state separation

- **Risk**: User confusion about pending vs saved states
  - **Mitigation**: Clear visual indicators and informative button text

## Dependencies

- Existing `ContentAssetsManager` component
- Existing server actions (`updateAssetSchedule`)
- FullCalendar library (already installed)
- date-fns-tz library (already installed)
- Existing toast system (Sonner)

## Out of Scope

- Changes to timezone conversion logic
- Database schema modifications
- New UI component libraries
- Real-time collaboration features
- Undo/redo functionality (beyond the existing revert behavior)

---

## Implementation Checklist

### Past Date Prevention ✨
- [x] Add date validation as first step in `handleEventDrop`
- [x] Use business timezone for date comparison with `toZonedTime`
- [x] Implement immediate revert + toast error (drag-drop best practice)
- [x] Add toast error message: "Cannot schedule content to a date in the past"
- [ ] Test timezone edge cases (today's date boundaries)
- [ ] Verify revert behavior works immediately and smoothly

### Batch Scheduling State Management ✨  
- [x] Add `pendingChanges` Map state management
- [x] Add `originalAssets` Map to track saved state
- [x] Add `hasUnsavedChanges` and `isSaving` states
- [x] Modify `handleEventDrop` to store changes locally only
- [x] Create visual indicators for pending vs saved events (styling)
- [x] Ensure calendar events reflect pending changes visually

### Schedule & Reset Buttons ✨
- [x] Add Schedule button component at bottom right
- [x] Implement change counter in button text (e.g., "Schedule (3 changes)")
- [x] Add disabled state when no pending changes
- [x] Add Reset Changes button to revert to saved state
- [x] Position buttons properly below calendar
- [x] Add loading states for save operation

### Batch Save & Error Handling ✨
- [x] Create `saveBatchScheduleChanges` server action for pending changes only
- [x] Implement granular error handling per asset update
- [x] Add optimistic updates and rollback logic
- [x] Integrate with existing timezone conversion logic
- [ ] Test bulk database operations with various error scenarios
- [x] Add comprehensive save/error state management

### Navigation Guards & Final Integration ✨
- [x] Implement navigation warning for unsaved changes
- [x] Add beforeunload event handler for browser close/refresh
- [x] Connect Schedule button to batch save functionality
- [x] Connect Reset Changes button to state reset
- [ ] Test navigation warnings work across all exit methods
- [ ] Ensure no regression in existing drag-drop functionality

### Comprehensive Testing ✨
- [ ] Test past date prevention across all timezones
- [ ] Test batch scheduling with multiple assets and edge cases
- [ ] Test reset functionality restores correct saved state
- [ ] Test navigation warnings appear when appropriate
- [ ] Verify visual indicators clearly distinguish pending vs saved
- [ ] Test error handling and rollback scenarios for batch saves
- [ ] Test Schedule button states (enabled/disabled/loading)
- [ ] Performance testing with large asset sets
- [ ] Cross-browser compatibility testing
- [ ] Accessibility testing for all new UI elements

---

**Total Tasks**: 35
**Completed**: 25 / 35 