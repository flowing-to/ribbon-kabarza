# Backup Solutions for Text Responsiveness

## Alternative Text Scaling Approaches

### 1. Scale Application Methods
**Current Implementation**: fontSize scaling
**Alternatives**:
- **Group Transform Scale**: Apply scale to parent group transform
  ```typescript
  groupRef.current.scale.setScalar(scaleFactor)
  ```
- **CSS Transform Scale**: Apply CSS transform to the text element
- **Hybrid Approach**: Combine fontSize + group scale for fine control

### 2. Timing Integration Methods
**Current Implementation**: Theatre.js callbacks
**Alternatives**:
- **setTimeout Based**: Use the existing 30ms setTimeout delay
  ```typescript
  setTimeout(() => {
    calculateAndApplyScale(newText)
    // existing text change logic
  }, 15) // 50% of 30ms
  ```
- **useFrame Integration**: Check animation progress in useFrame loop
- **Event Listeners**: Custom events dispatched from animation

### 3. Text Measurement Methods
**Current Implementation**: Canvas-based measurement
**Alternatives**:
- **Three.js Text getBoundingBox()**: Use built-in Three.js text measurement
- **DOM Measurement**: Create hidden DOM element for measurement
- **Font Metrics API**: Use browser's Font Loading API for precise metrics
- **Pre-calculated Lookup**: Static font metrics table

### 4. Viewport Calculation Methods
**Current Implementation**: window.innerWidth * 0.8
**Alternatives**:
- **Available Text Area**: Calculate based on UI elements and margins
- **Responsive Breakpoints**: Different percentages for mobile/tablet/desktop
- **Dynamic Margins**: Adjust based on content length and device

### 5. Performance Optimization Methods
**Current Implementation**: 30ms debounced resize
**Alternatives**:
- **RequestAnimationFrame**: Throttle using RAF instead of debounce
- **Intersection Observer**: Only calculate when text is visible
- **Memoization**: Cache calculations based on text + viewport size
- **Web Workers**: Offload text measurement to worker thread

## Implementation Notes
- Keep fontSize approach as primary due to simplicity
- Theatre.js callbacks provide most precise timing control
- Canvas measurement gives consistent cross-browser results
- Debouncing prevents excessive calculations during resize