# Manuel App Graphics Implementation Guide

## AI Image Generation Prompts

### Application Icon Prompts

#### Primary Icon Prompt

```
A cheerful Spanish waiter character in the style of 1970s British comedy, wearing a traditional black and white waiter's uniform with bow tie. He has a distinctive thick black mustache, dark hair, and an expressive friendly face. The character is holding out his hand with an open book floating above his palm, glowing softly with warm light. The book has pages that appear to be manual pages with technical diagrams visible. The style should be clean, modern illustration suitable for an iOS app icon, with a circular or rounded square background in warm colors (deep blue or burgundy). The character should look helpful and approachable, with a slight smile. Professional digital illustration style, clean lines, suitable for mobile app icon at various sizes from 29x29 to 1024x1024 pixels.
```

#### Alternative Modern Icon Prompt

```
A modern, stylized icon featuring a friendly waiter character silhouette with a distinctive mustache, holding an open book with pages that transform into floating help symbols (question marks, lightbulbs, gears). The design should be minimalist and clean, suitable for iOS app icon guidelines. Use a blue and orange color scheme with the character in navy blue and the book elements in warm orange. The background should be a subtle gradient circle. The style should be flat design with subtle shadows, optimized for scalability from 29x29 to 1024x1024 pixels.
```

### Application Banner Prompts

#### Primary Banner Prompt

```
A horizontal banner illustration featuring the same cheerful Spanish waiter character from the app icon, positioned on the left side of the composition. He's wearing his traditional black and white waiter's uniform with bow tie and has a thick black mustache. The character is gesturing welcomingly toward the right side of the banner where elegant typography reads "Manuel" in a classic serif font. The background should be a subtle gradient from warm blue to light gray, with floating book pages and technical manual diagrams softly illustrated in the background. The style should be professional, clean, and suitable for mobile app headers. Dimensions should be optimized for mobile screens, approximately 16:9 aspect ratio. The overall mood should be welcoming, professional, and suggest expertise in manual assistance.
```

#### Retro-Modern Banner Prompt

```
A horizontal app banner with a retro-modern aesthetic, featuring a stylized waiter character with a black mustache on the left, extending his hand toward floating manual pages and technical diagrams that spiral across the banner. The text "Manuel" appears in elegant lettering on the right side. The color palette should include navy blue, warm orange, and cream colors. The style should blend 1970s British comedy aesthetic with modern mobile app design principles. Suitable for mobile app headers and marketing materials.
```

## Technical Requirements

### iOS App Icon Specifications

#### Required Sizes (iOS 17+)

- **1024x1024px**: App Store and high-resolution displays
- **180x180px**: iPhone app icon (iOS 14+)
- **152x152px**: iPad app icon
- **120x120px**: iPhone app icon (iOS 13)
- **87x87px**: iPhone settings icon
- **76x76px**: iPad app icon (iOS 13)
- **58x58px**: iPhone settings icon (iOS 13)
- **40x40px**: iPad settings icon
- **29x29px**: iPhone settings icon (iOS 13)

#### Format Requirements

- **File Format**: PNG (no transparency for app icons)
- **Color Space**: sRGB
- **Compression**: None (use original quality)

### Banner Specifications

#### Mobile App Header Banner

- **Dimensions**: 375x150px (1x), 750x300px (2x), 1125x450px (3x)
- **Aspect Ratio**: 2.5:1 (flexible)
- **File Format**: PNG with transparency support
- **Color Space**: sRGB
- **Safe Area**: 20px padding on all sides

#### Alternative Banner Sizes

- **iPhone 14 Pro Max**: 430x172px
- **iPhone 14 Pro**: 393x157px
- **iPhone 14**: 390x156px
- **iPad**: 834x334px

## Implementation Steps

### Step 1: Generate Images with AI Tools

1. Use DALL-E 3 (via ChatGPT Plus) or Midjourney
2. Generate multiple variations of each design
3. Save in highest available resolution
4. Export as PNG format

### Step 2: Image Optimization

1. Use tools like TinyPNG or ImageOptim for compression
2. Maintain quality while reducing file size
3. Create all required iOS icon sizes using tools like:
   - Icon Set Creator (Mac)
   - App Icon Generator (online)
   - Sketch/Figma with iOS icon templates

### Step 3: Integration into React Native App

#### Icon Integration

```javascript
// Update app.json or app.config.js
{
  "expo": {
    "icon": "./assets/icon.png",
    "ios": {
      "icon": "./assets/icon.png"
    }
  }
}
```

#### Banner Integration

```tsx
// In your component
import { Image } from 'react-native';

const ManuelBanner = () => (
  <View style={styles.bannerContainer}>
    <Image
      source={require('./assets/manuel-banner.png')}
      style={styles.bannerImage}
      resizeMode="contain"
    />
  </View>
);
```

## File Structure

```
frontend/
├── assets/
│   ├── icons/
│   │   ├── icon-1024.png
│   │   ├── icon-180.png
│   │   ├── icon-152.png
│   │   └── ... (all required sizes)
│   ├── banners/
│   │   ├── manuel-banner@1x.png
│   │   ├── manuel-banner@2x.png
│   │   └── manuel-banner@3x.png
│   └── graphics/
│       ├── manuel-character.png
│       └── manuel-logo.png
```

## Color Palette

### Primary Colors

- **Manuel Blue**: #1E3A8A (Navy Blue)
- **Manuel Orange**: #F59E0B (Warm Orange)
- **Manuel Cream**: #FEF3C7 (Light Cream)

### Secondary Colors

- **Background Gray**: #F3F4F6
- **Text Dark**: #1F2937
- **Text Light**: #6B7280

## Design Guidelines

### Character Consistency

- Always maintain the distinctive mustache
- Keep the waiter uniform elements (bow tie, vest)
- Ensure friendly, approachable expression
- Use consistent proportions across all graphics

### Brand Consistency

- Use the same color palette across all graphics
- Maintain consistent typography when text is included
- Ensure all graphics work on both light and dark backgrounds
- Keep the "helpful assistant" theme prominent

## Testing and Validation

### Icon Testing

- Test all icon sizes on actual devices
- Verify icons display correctly in App Store
- Check icon appearance on different iOS versions
- Validate accessibility and readability

### Banner Testing

- Test on various screen sizes and orientations
- Verify banner scales properly on different devices
- Check performance impact of image loading
- Validate banner integrates well with app navigation

## Asset Management

### Version Control

- Keep original high-resolution files
- Version all graphics with semantic versioning
- Maintain source files for future modifications
- Document any changes or iterations

### Distribution

- Include all required sizes in app bundle
- Optimize for app store submission
- Consider progressive loading for larger graphics
- Implement lazy loading where appropriate
