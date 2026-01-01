# CandleShrine + HandsGLTFScene + PhoneScreenFeed Integration

## What Was Done

### 1. **Updated HandsGLTFScene Component**
- Added imports for the PhoneScreenFeed3D component
- Added props to receive offerings data from parent component
- Added a `phoneScreenRef` to find and track the PhoneScreen mesh in the 3D model
- Integrated PhoneScreenFeed3D to display on the phone screen mesh when found
- Props added: `offerings`, `hoveredOffering`, `justLitOffering`, `onJustLitComplete`

### 2. **Updated CandleShrine Component**
- Modified to accept external offerings data and callback props
- Added `onSelectOffering` callback to notify parent when user hovers over candles
- Added `onLightCandle` callback to notify parent when user lights a candle
- Connected the "Light a Candle" button to trigger the callback

### 3. **Updated Home Page (page.js)**
- Added state management for offerings data sharing between components:
  - `hoveredOffering`: Track which offering is being hovered
  - `justLitOffering`: Track newly lit candle offerings
  - `mockOfferings`: Sample data array with user prayers/petitions
- Connected CandleShrine and HandsGLTFScene through shared state
- Pass offerings data and callbacks to both components

### 4. **PhoneScreenFeed Component (already prepared)**
- Displays user messages in a phone UI format
- Supports three states:
  - Cycling through offerings automatically
  - Showing hovered offering when user hovers a candle
  - Showing "Prayer Received" confirmation when candle is lit
- Includes the PhoneScreenFeed3D wrapper for R3F integration

## How It Works

1. **User hovers over a candle in CandleShrine**
   → CandleShrine calls `onSelectOffering` with the offering data
   → Home page updates `hoveredOffering` state
   → HandsGLTFScene receives the update and shows it on the phone screen

2. **User clicks "Light a Candle" button**
   → CandleShrine calls `onLightCandle` with new offering
   → Home page updates `justLitOffering` state
   → Phone screen shows "Prayer Received" confirmation
   → After 3 seconds, returns to cycling mode

3. **Default state**
   → Phone screen automatically cycles through all offerings
   → Shows user names, messages, and tokens burned

## Next Steps

To complete the integration:

1. **Find the PhoneScreen mesh in your 3D model**
   - The code looks for meshes named: 'PhoneScreen', 'phonescreen', 'phone_screen', 'Phone_Screen'
   - Check your hands3.glb model to identify the correct mesh name
   - Update the search criteria in HandsGLTFScene if needed

2. **Adjust positioning and scale**
   - The PhoneScreenFeed3D component uses `scale={0.005}` by default
   - You may need to adjust this based on your model's scale
   - You may also need to adjust the position offset

3. **Connect to real data**
   - Replace `mockOfferings` with real data from your Firebase database
   - The structure should match the current format with name, type, message, tokensBurned

4. **Style customization**
   - The phone screen UI can be customized in Phonescreenfeed.jsx
   - Adjust colors, animations, and layout as needed

## Testing

To test the integration:
1. Open http://localhost:3000/home in your browser
2. Hover over candles in the background to see offerings appear on the phone
3. Click "Light a Candle" button to see the confirmation message
4. Watch the phone screen cycle through different user messages automatically