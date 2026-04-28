# Regional Language Support Guide for AgriVision

## Overview

This guide explains the best practices for supporting regional languages in the AgriVision project. The current implementation supports **6 languages**: English, Hindi, Telugu, Tamil, Marathi, and Kannada.

## Current Implementation

### Architecture

1. **Translation File**: `app/static/js/translations.js`
   - Contains all translations in a structured JSON format
   - Each language has its own key (en, hi, te, ta, mr, kn)
   - Easy to add new languages

2. **Language Manager**: `app/static/js/language.js`
   - Handles language switching
   - Persists user preference in localStorage
   - Automatically translates elements with `data-i18n` attribute

3. **HTML Integration**: 
   - Use `data-i18n="key"` attribute on elements that need translation
   - Example: `<span data-i18n="home">Home</span>`

## Best Practices for Regional Language Support

### 1. **Translation Management**

#### Option A: Client-Side Translation (Current Approach)
**Pros:**
- Fast, no server requests
- Works offline
- Simple implementation
- Good for static content

**Cons:**
- Translation file grows with content
- All languages loaded upfront
- Harder to update translations dynamically

**Best For:** Small to medium applications, static content, offline support

#### Option B: Server-Side Translation
**Pros:**
- Dynamic translation updates
- Can use translation services (Google Translate API, etc.)
- Better for large applications
- Can cache translations

**Cons:**
- Requires server requests
- More complex implementation
- Needs backend support

**Best For:** Large applications, dynamic content, enterprise solutions

#### Option C: Hybrid Approach (Recommended for Scale)
**Pros:**
- Static translations for common UI elements (client-side)
- Dynamic translations for user-generated content (server-side)
- Best of both worlds

**Cons:**
- More complex architecture

**Best For:** Production applications with user-generated content

### 2. **Adding New Languages**

#### Step 1: Add Language to translations.js

```javascript
const translations = {
  // ... existing languages
  gu: {  // Gujarati
    home: "ઘર",
    // ... add all keys
  },
  pa: {  // Punjabi
    home: "ਘਰ",
    // ... add all keys
  }
};

const languageNames = {
  // ... existing
  gu: "ગુજરાતી",
  pa: "ਪੰਜਾਬੀ"
};
```

#### Step 2: Update Language Selector
The language dropdown will automatically include new languages if they're in `languageNames`.

#### Step 3: Test RTL Languages (if needed)
For languages like Arabic, Urdu, Hebrew:
- Add `dir="rtl"` to HTML element
- Adjust CSS for right-to-left layout
- Test all UI components

### 3. **Translation Keys Organization**

**Current Structure:**
```javascript
{
  // Navigation
  home: "...",
  weatherLens: "...",
  
  // Sections
  diseaseDetectionTitle: "...",
  diseaseDetectionSubtitle: "...",
  
  // Actions
  signIn: "...",
  signOut: "..."
}
```

**Best Practice:**
- Use descriptive, hierarchical keys
- Group related translations
- Keep keys consistent across languages
- Use camelCase for JavaScript compatibility

### 4. **Dynamic Content Translation**

For content that comes from APIs (like Gemini responses):

#### Option A: Translate on Server
```python
# In your FastAPI endpoint
def translate_content(content, target_lang):
    # Use translation API or service
    return translated_content
```

#### Option B: Translate on Client
```javascript
// Use browser's translation API or service
async function translateText(text, targetLang) {
  // Call translation service
  return translatedText;
}
```

#### Option C: Request in User's Language
```python
# In predict.py
def get_disease_info_from_gemini(disease_name, language='en'):
    prompt = f"Describe {disease_name} in {language}..."
    # Gemini will respond in requested language
```

**Recommended:** Option C - Request content directly in user's language from Gemini API.

### 5. **Font Support**

#### Web Fonts for Regional Languages

**Google Fonts:**
- Hindi: Noto Sans Devanagari
- Telugu: Noto Sans Telugu
- Tamil: Noto Sans Tamil
- Marathi: Noto Sans Devanagari (same as Hindi)
- Kannada: Noto Sans Kannada

**Implementation:**
```html
<link href="https://fonts.googleapis.com/css2?family=Noto+Sans+Devanagari:wght@400;600;700&family=Noto+Sans+Telugu:wght@400;600;700&family=Noto+Sans+Tamil:wght@400;600;700&family=Noto+Sans+Kannada:wght@400;600;700&display=swap" rel="stylesheet">
```

```css
body {
  font-family: 'Noto Sans', -apple-system, BlinkMacSystemFont, sans-serif;
}

[lang="hi"], [lang="mr"] {
  font-family: 'Noto Sans Devanagari', sans-serif;
}

[lang="te"] {
  font-family: 'Noto Sans Telugu', sans-serif;
}

[lang="ta"] {
  font-family: 'Noto Sans Tamil', sans-serif;
}

[lang="kn"] {
  font-family: 'Noto Sans Kannada', sans-serif;
}
```

### 6. **Number and Date Formatting**

Different languages use different number formats:

```javascript
// Format numbers based on locale
function formatNumber(num, lang) {
  return new Intl.NumberFormat(lang === 'hi' ? 'hi-IN' : 'en-IN').format(num);
}

// Format dates
function formatDate(date, lang) {
  return new Intl.DateTimeFormat(lang === 'hi' ? 'hi-IN' : 'en-IN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  }).format(date);
}
```

### 7. **Testing Checklist**

- [ ] All UI elements translate correctly
- [ ] Text doesn't overflow containers
- [ ] Fonts render correctly
- [ ] Numbers and dates format correctly
- [ ] RTL languages (if any) display correctly
- [ ] Language preference persists
- [ ] Dynamic content (API responses) can be translated
- [ ] Forms and inputs work with all languages
- [ ] Error messages translate
- [ ] Loading states translate

### 8. **Performance Optimization**

#### Lazy Loading Translations
```javascript
// Load translations on demand
async function loadLanguage(langCode) {
  if (!translations[langCode]) {
    const response = await fetch(`/static/translations/${langCode}.json`);
    translations[langCode] = await response.json();
  }
  return translations[langCode];
}
```

#### Translation Caching
- Cache translations in localStorage
- Update cache when translations change
- Use version numbers for cache invalidation

### 9. **Accessibility**

- Set `lang` attribute on HTML element: `<html lang="hi">`
- Screen readers will use correct language
- Helps with SEO and search engines

### 10. **Common Pitfalls to Avoid**

1. **Hardcoded Text**: Always use translation keys
2. **Concatenation**: Don't concatenate translated strings
   ```javascript
   // Bad
   t('welcome') + ' ' + userName
   
   // Good
   t('welcomeUser', { name: userName })
   ```
3. **Context Loss**: Provide context in translation keys
   ```javascript
   // Bad
   t('save')
   
   // Good
   t('saveButton') or t('saveFile')
   ```
4. **Pluralization**: Handle plural forms correctly
   ```javascript
   // Use libraries like i18next for proper pluralization
   t('itemCount', { count: items.length })
   ```

## Recommended Next Steps

1. **Add More Languages**: Based on your user base
   - Bengali (bn)
   - Gujarati (gu)
   - Punjabi (pa)
   - Odia (or)
   - Malayalam (ml)

2. **Implement Font Loading**: Add Noto Sans fonts for better rendering

3. **Translate API Responses**: Modify Gemini API calls to request content in user's language

4. **Add Language Detection**: Auto-detect user's browser language

5. **Create Translation Management System**: For easier updates and collaboration

## Resources

- [MDN: Internationalization](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl)
- [Google Fonts: Noto Sans](https://fonts.google.com/noto)
- [i18next: Internationalization Framework](https://www.i18next.com/)
- [W3C: Language Tags](https://www.w3.org/International/articles/language-tags/)

## Current Language Support

| Language | Code | Status | Font Support |
|----------|------|--------|--------------|
| English  | en   | ✅ Complete | Native |
| Hindi    | hi   | ✅ Complete | Noto Sans Devanagari |
| Telugu   | te   | ✅ Complete | Noto Sans Telugu |
| Tamil    | ta   | ✅ Complete | Noto Sans Tamil |
| Marathi  | mr   | ✅ Complete | Noto Sans Devanagari |
| Kannada  | kn   | ✅ Complete | Noto Sans Kannada |

---

**Note**: This implementation uses a simple client-side approach. For production applications with extensive content, consider migrating to a more robust i18n solution like i18next or react-i18next (if using React).

