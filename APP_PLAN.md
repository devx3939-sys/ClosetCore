# ClosetCore - Complete Product Plan

## 1. App Overview

**App Name Ideas:**
- ClosetAI
- StyleVault
- OutfitPal
- ColorMatch
- MyCloset

**Core Value Proposition:** An AI-powered personal styling app that helps users discover colors that look good on them, manage their wardrobe digitally, and create perfectly coordinated outfits.

**Platforms:** iOS App, Android App, Web Application (responsive)

---

## 2. Core Features

### 2.1 Color Analysis & Personal Styling
- **AI Skin Tone Analysis**: Upload a selfie or photo of bare face/arms to analyze undertones
- **Seasonal Color Palette**: Assign users to Spring, Summer, Autumn, or Winter color seasons
- **Color Recommendations**: Suggest clothing colors, accessories, and makeup shades that complement their palette
- **Virtual Try-On**: Preview how different colors look on user (via AR)

### 2.2 Closet Management
- **Item Catalog**: Store unlimited clothing items, accessories, shoes, bags
- **Photo Upload**: Take photos or import from gallery
- **Manual Entry**: Add items with details (brand, size, price, color, category, season, occasion)
- **Item Tagging**: Categorize by type, color, season, occasion, favorite status
- **Search & Filter**: Find items by category, color, season, brand, etc.
- **Item Details**: Store purchase date, wear count, condition, notes

### 2.3 Outfit Creation
- **Drag & Drop Builder**: Create outfits by combining closet items
- **AI Outfit Suggestions**: Get AI-generated outfit ideas based on:
  - Weather forecast
  - Occasion (work, casual, date, event)
  - Color harmony rules
  - Previous outfit history
- **Outfit Templates**: Save favorite combinations as templates
- **Mix & Match**: See how new items pair with existing wardrobe

### 2.4 Photo & Camera Features
- **Closet Photo Mode**: Quickly photograph multiple items in sequence
- **Background Removal**: Auto-remove backgrounds for clean item photos
- **Image Enhancement**: Auto-crop, adjust lighting, enhance clarity
- **Outfit Photos**: Take full-body outfit photos

### 2.5 Organization & Planning
- **Calendar Planning**: Plan outfits for upcoming dates
- **Packing Lists**: Create packing lists for trips
- **Wishlist**: Save items user wants to buy
- **Gift Ideas**: Track gift ideas for others

### 2.6 Social & Community
- **Share Outfits**: Share outfits to community feed (optional)
- **Like & Comment**: Interact with other users' outfits
- **Follow Stylists**: Follow fashion influencers
- **Shop Integration**: Link to purchase items

---

## 3. User Flow & Experience

### 3.1 Onboarding Flow
1. **Welcome Screen**: App introduction and value proposition
2. **Account Creation**: Email, social login, or continue as guest
3. **Style Quiz**: 
   - Preferred clothing style (casual, formal, sporty, boho, etc.)
   - Typical occasions
   - Budget range
4. **Color Analysis**: 
   - Upload selfie for AI color analysis
   - OR manually select skin tone/hair color/eye color
5. **Initial Closet**: 
   - Option to import from photos
   - Quick add favorite pieces
6. **Notifications Setup**: Weather alerts, outfit reminders

### 3.2 Daily User Flow
1. **Home Dashboard**: Today's weather, outfit suggestion, quick actions
2. **Closet Tab**: Browse, search, filter items
3. **Outfit Builder**: Create new outfit
4. **Calendar**: View planned outfits
5. **Profile**: Settings, stats, preferences

### 3.3 Key Screens
- **Splash/Onboarding**
- **Home/Dashboard**
- **Closet Grid View**
- **Item Detail View**
- **Add Item Flow**
- **Outfit Builder**
- **Outfit Detail**
- **Color Palette**
- **Calendar**
- **Profile/Settings**
- **Search Results**
- **Community Feed**

---

## 4. Technical Architecture

### 4.1 Frontend
- **Mobile App**: React Native or Flutter (cross-platform)
- **Web App**: React.js or Next.js (responsive PWA)
- **State Management**: Redux, MobX, or Context API

### 4.2 Backend
- **API**: Node.js with Express or Python with FastAPI
- **Database**: PostgreSQL (relational data) + MongoDB (flexible schemas)
- **Authentication**: JWT tokens, OAuth 2.0
- **File Storage**: AWS S3 or Cloudinary (images)
- **CDN**: CloudFront or similar (image delivery)

### 4.3 AI/ML Components
- **Color Analysis**: TensorFlow or PyTorch model for skin tone analysis
- **Outfit Suggestions**: Recommendation engine (collaborative filtering)
- **Image Processing**: OpenCV for background removal
- **NLP**: Chatbot for style advice (optional)

### 4.4 Third-Party Integrations
- **Weather API**: OpenWeatherMap or WeatherAPI
- **E-commerce**: Amazon, Nordstrom, etc. (affiliate links)
- **Social Auth**: Google, Apple, Facebook
- **Push Notifications**: Firebase Cloud Messaging

---

## 5. Data Models

### 5.1 User
```
- id: UUID
- email: string
- name: string
- avatar: string (URL)
- colorSeason: enum (spring, summer, autumn, winter)
- skinTone: hex code
- hairColor: enum
- eyeColor: enum
- stylePreferences: array
- createdAt: timestamp
- updatedAt: timestamp
```

### 5.2 ClosetItem
```
- id: UUID
- userId: UUID (FK)
- name: string
- category: enum (tops, bottoms, dresses, shoes, accessories, outerwear)
- subcategory: string
- color: hex code
- colorFamily: string
- brand: string
- size: string
- season: array (spring, summer, fall, winter)
- occasion: array (casual, work, formal, sporty)
- imageUrl: string
- thumbnailUrl: string
- purchaseDate: date
- purchasePrice: number
- wearCount: number
- condition: enum (new, like-new, good, fair)
- isFavorite: boolean
- notes: string
- createdAt: timestamp
```

### 5.3 Outfit
```
- id: UUID
- userId: UUID (FK)
- name: string
- items: array (ClosetItem IDs)
- occasion: enum
- season: enum
- weather: object
- isFavorite: boolean
- timesWorn: number
- lastWorn: date
- createdAt: timestamp
```

### 5.4 ColorPalette
```
- id: UUID
- userId: UUID (FK)
- season: enum
- primaryColors: array (hex)
- secondaryColors: array (hex)
- accentColors: array (hex)
- neutralColors: array (hex)
- avoidColors: array (hex)
```

---

## 6. UI/UX Design Guidelines

### 6.1 Visual Style
- **Aesthetic**: Clean, modern, minimalist with pops of color
- **Typography**: Sans-serif (Inter, SF Pro, or similar)
- **Iconography**: Outlined icons, consistent stroke weight
- **Imagery**: High-quality product photos, lifestyle shots

### 6.2 Color Scheme
- **Primary**: Neutral (white, gray, black) to let user items shine
- **Accent**: User's personalized color palette
- **Success**: Green (#4CAF50)
- **Error**: Red (#F44336)
- **Warning**: Amber (#FFC107)

### 6.3 Layout Approach
- **Mobile**: Bottom tab navigation (5 tabs max)
- **Grid Layout**: Masonry or uniform grid for closet items
- **Cards**: Outfit cards with item thumbnails
- **Full-screen**: Outfit builder, camera, color analysis

### 6.4 Interactions
- **Haptic Feedback**: On item selection, save actions
- **Gestures**: Swipe to favorite, long-press for options
- **Animations**: Smooth transitions, subtle micro-interactions
- **Loading States**: Skeleton screens, shimmer effects

---

## 7. Feature Priority

### Phase 1 - MVP (Must Have)
- [ ] User account creation
- [ ] Closet item upload (photo + manual)
- [ ] Item organization (categories, tags)
- [ ] Basic outfit creation
- [ ] Color analysis (photo-based)
- [ ] Personal color palette generation
- [ ] Search and filter closet
- [ ] Save/edit/delete items and outfits

### Phase 2 - Enhanced (Should Have)
- [ ] AI outfit suggestions
- [ ] Calendar planning
- [ ] Weather integration
- [ ] Background removal for photos
- [ ] Outfit sharing
- [ ] Wear tracking/statistics
- [ ] Wishlist
- [ ] Packing lists

### Phase 3 - Advanced (Nice to Have)
- [ ] Social community features
- [ ] Virtual try-on (AR)
- [ ] Shopping integration
- [ ] Style chatbot
- [ ] Collaboration features (shared closets)
- [ ] Premium AI features

---

## 8. Monetization Strategy

### Free Tier
- Up to 50 closet items
- Basic color analysis
- Create up to 10 outfits
- Basic search/filter

### Premium Subscription ($4.99/month)
- Unlimited closet items
- Advanced AI color analysis
- Unlimited outfits
- AI outfit suggestions
- Weather integration
- Calendar planning
- No ads
- Priority support

### One-Time Purchase
- $9.99: Lifetime premium (no subscription)

### Additional Revenue
- Affiliate commissions (linked products)
- In-app purchases (extra color palettes, themes)
- Sponsored content in community feed

---

## 9. Development Timeline

### Phase 1: Foundation (Weeks 1-4)
- Project setup
- UI/UX design mockups
- Backend architecture
- Database design
- Authentication

### Phase 2: Core Features (Weeks 5-10)
- Closet management
- Item upload and editing
- Basic outfit builder
- Color analysis algorithm
- Search and filter

### Phase 3: AI Features (Weeks 11-14)
- AI outfit suggestions
- Recommendation engine
- Weather integration
- Calendar features

### Phase 4: Polish (Weeks 15-18)
- UI refinements
- Performance optimization
- Bug fixes
- Testing
- App store submission

---

## 10. Success Metrics

### Key Performance Indicators
- **User Acquisition**: Downloads, sign-ups
- **Retention**: Daily/monthly active users
- **Engagement**: Items per user, outfits created
- **Conversion**: Free to premium conversion rate
- **Ratings**: App store ratings and reviews

### Analytics to Track
- Most used features
- Drop-off points in onboarding
- Popular item categories
- Outfit creation patterns
- Color palette usage

---

## 11. Competitive Analysis

### Direct Competitors
- **Cladwell**: Outfit planning, subscription-based
- **Acloset**: AI styling, closet management
- **Smart Closet**: Outfit organizer

### Differentiation
- **Color-First Approach**: Unique focus on personal color analysis
- **Free-Forever Tier**: Generous free tier vs competitors
- **Cross-Platform**: Mobile + Web
- **AI-Powered**: Advanced AI suggestions

---

## 12. Next Steps

1. **Design Phase**: Create detailed wireframes and mockups
2. **Technical Specification**: Full technical docs
3. **Prototype**: Build clickable prototype
4. **User Testing**: Test with target audience
5. **Development**: Start coding MVP
6. **Beta Launch**: Release to small user group
7. **Iterate**: Gather feedback and improve

---

*Document Version: 1.0*
*Created: April 28, 2026*