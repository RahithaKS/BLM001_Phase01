# LedgerLM Dashboard - Design Guidelines

## Design Approach
**Reference-Based Design**: Replicating the exact LedgerLM interface with precision, drawing inspiration from modern fintech applications like Plaid and Stripe for professional financial UX patterns.

## Color Palette
**Primary Colors:**
- Teal Primary: `#3B9B96` (HSL 177, 45%, 42%) - primary buttons, CTAs
- Purple/Lavender Accent: `#B794F6` (HSL 260, 50%, 55%) - sidebar left border, ring states
- Light Purple Background: `#F0EBFA` (HSL 260, 60%, 95%) - sidebar active states
- Dark Background: `#1A1A1A` or `#0F1419` (welcome screen background)

**Neutral Colors:**
- Light Cyan/Mint Background: `#E8F4F3` (HSL 177, 25%, 94%) - main content area background
- White: `#FFFFFF` (card backgrounds)
- Light Gray: `#F5F5F5` or `#FAFAFA` (sidebar background)
- Medium Gray: `#9E9E9E` (secondary text)
- Dark Gray: `#424242` (primary text)

**Accent Colors:**
- Light Teal: `#A8D5D3` (HSL 177, 25%, 90%) - accent backgrounds
- Soft Mint: `#E0F2F1` (subtle backgrounds)

## Typography
**Font Stack:**
- Primary: Inter or system fonts (`-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`)
- Weights: 400 (regular), 500 (medium), 600 (semibold), 700 (bold)

**Type Scale:**
- Heading 1: 32px/bold (Welcome messages)
- Heading 2: 24px/semibold (Section titles)
- Heading 3: 18px/semibold (Card titles)
- Body: 14px/regular (Main content)
- Small: 12px/regular (Metadata, timestamps)

## Layout System
**Spacing Units:** Tailwind spacing - primary units: 2, 4, 6, 8, 12, 16, 24

**Grid Structure:**
- Sidebar: Fixed 280px width
- Main content: Flex-grow with max-width 1400px, centered
- Content padding: 24px to 32px

## Core Components

### 1. Welcome Screen
- Full viewport height (100vh)
- Dark background with animated network visualization (particle connections)
- Centered content card with glassmorphic effect
- Logo at top, welcome message, sign-in button
- Network animation: Subtle moving dots connected by lines in teal/pink

### 2. Sidebar Navigation
- Fixed left sidebar, full height
- Logo at top (24px padding)
- Navigation items with icons (Home, Vault, Boards, Market Intelligence)
- Active state: Pink highlight with teal background
- Recent chats section below navigation
- Each chat item: Title, timestamp, truncated preview

### 3. Main Dashboard
**Header Section:**
- Greeting message "Hi John!" in large heading
- Subheading prompt text in gray

**Action Cards Grid:**
- 3 cards in single row (grid-cols-3 gap-6)
- Each card: Icon (40px), title, description
- White background, subtle shadow, rounded corners (12px)
- Hover: Slight lift with increased shadow

**Card Details:**
1. "Generate quick summary" - Document icon
2. "Develop context-aware insights" - Lightbulb icon  
3. "Simulate using Goal seeking AI" - Target icon

### 4. Chat Input Section
- Bottom of main content area
- Full-width input field with rounded corners
- Placeholder: "Ask LedgerLM anything about your financials..."
- Action button: Teal background, white text, "Ask LedgerLM"
- Microphone icon option on right

### 5. Recent Chats Sidebar
- Within left sidebar, below navigation
- Section title "Recent Chats"
- List items: Bold title, light metadata text
- Examples: "Q2 Profit & Loss Summary", "Balance Sheet Breakdown"
- Hover: Light background highlight

## Component Specifications

**Buttons:**
- Primary: Teal background, white text, 40px height, 12px border radius
- Secondary: White background, teal border and text
- Padding: 12px horizontal, 10px vertical
- Font: 14px medium weight

**Cards:**
- Background: White or #FAFAFA
- Border radius: 12px
- Padding: 24px
- Shadow: `0 2px 8px rgba(0,0,0,0.08)`
- Hover shadow: `0 4px 16px rgba(0,0,0,0.12)`

**Navigation Items:**
- Height: 48px
- Padding: 12px 16px
- Icon size: 20px
- Gap between icon and text: 12px
- Active: Pink left border (4px), teal background tint

**Input Fields:**
- Height: 48px
- Border: 1px solid #E0E0E0
- Border radius: 24px (pill shape)
- Padding: 12px 20px
- Focus: Teal border, subtle shadow

## Animations
**Minimal, Purposeful Animations:**
- Welcome screen: Gentle particle network movement (slow, ambient)
- Navigation hover: Smooth 200ms background transition
- Card hover: Transform scale(1.02) with 300ms ease
- Button hover: 200ms color transition
- NO excessive scroll effects or distracting movements

## Accessibility
- Minimum contrast ratio 4.5:1 for text
- Focus states with visible outline (teal)
- Keyboard navigation support
- Semantic HTML structure
- ARIA labels for icon-only buttons

## Images
**Welcome Screen Background:**
- Abstract network visualization with connected nodes
- Dark base (#1A1A1A) with teal/pink gradient particles
- Subtle movement/animation
- Alternative: Use canvas-based particle system or static abstract tech pattern

**Icons:**
- Use Heroicons or Lucide React for consistency
- Outline style, 20-24px size
- Colors match component context (teal for primary, gray for secondary)

## Responsive Behavior
- Desktop (1024px+): Full sidebar visible, 3-column card grid
- Tablet (768px-1023px): Collapsible sidebar, 2-column cards
- Mobile (<768px): Hidden sidebar with hamburger menu, single column cards, stack all elements

This design creates a professional, modern financial analysis interface with exact color matching and layout precision as shown in the provided screenshots.