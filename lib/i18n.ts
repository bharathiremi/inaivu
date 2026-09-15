export type LanguageCode =
  | "auto"
  | "en"
  | "ta"
  | "hi"
  | "te"
  | "kn"
  | "ml"
  | "bn"
  | "mr"
  | "gu"
  | "pa"
  | "ur"
  | "zh"
  | "ja"
  | "ko"
  | "es"
  | "fr"
  | "de"
  | "pt"
  | "ru"
  | "ar";

export const LANGUAGE_NAMES: Record<LanguageCode, string> = {
  auto: "Auto",
  en: "English",
  ta: "தமிழ்",
  hi: "हिन्दी",
  te: "తెలుగు",
  kn: "ಕನ್ನಡ",
  ml: "മലയാളം",
  bn: "বাংলা",
  mr: "मराठी",
  gu: "ગુજરાતી",
  pa: "ਪੰਜਾਬੀ",
  ur: "اردو",
  zh: "中文",
  ja: "日本語",
  ko: "한국어",
  es: "Español",
  fr: "Français",
  de: "Deutsch",
  pt: "Português",
  ru: "Русский",
  ar: "العربية",
};

type TranslationMap = Record<string, string>;

const en: TranslationMap = {
  Home: "Home",
  Chat: "Chat",
  Messages: "Messages",
  Notifications: "Notifications",
  Profile: "Profile",
  Settings: "Settings",
  Search: "Search",
  Loop: "Loop",
  Saved: "Saved",
  Explore: "Explore",
  Following: "Following",
  Followers: "Followers",
  Follow: "Follow",
  Unfollow: "Unfollow",
  Like: "Like",
  Comment: "Comment",
  Share: "Share",
  Save: "Save",
  Send: "Send",
  Post: "Post",
  Posts: "Posts",
  Create: "Create",
  Edit: "Edit",
  Delete: "Delete",
  Cancel: "Cancel",
  Done: "Done",
  Close: "Close",
  Back: "Back",
  Next: "Next",
  More: "More",

  "No notifications yet": "No notifications yet",
  "No messages yet": "No messages yet",
  "No posts yet": "No posts yet",
  "No saved Loops yet": "No saved Loops yet",

  "Search people": "Search people",
  "Search messages": "Search messages",
  "Write a message": "Write a message",
  "Write something...": "Write something...",
  "What's happening?": "What's happening?",
  "Add a comment...": "Add a comment...",
  "Start a conversation": "Start a conversation",

  "Your activity": "Your activity",
  "Privacy & Safety": "Privacy & Safety",
  "Language & Region": "Language & Region",
  Appearance: "Appearance",
  Security: "Security",
  Account: "Account",
  Privacy: "Privacy",
  "Data & Media": "Data & Media",
  "Help & Support": "Help & Support",
  "About Inaivu": "About Inaivu",

  Logout: "Logout",
  "Log out": "Log out",
  "Edit profile": "Edit profile",

  Online: "Online",
  Offline: "Offline",
  "Active now": "Active now",
  You: "You",

  System: "System",
  Light: "Light",
  Dark: "Dark",

  Language: "Language",
  English: "English",
  Tamil: "Tamil",
  "Change language": "Change language",
  "Choose your language": "Choose your language",

  Public: "Public",
  "Followers only": "Followers only",
  Private: "Private",

  "Show online status": "Show online status",
  "Allow messages": "Allow messages",

  "Notification settings": "Notification settings",
  "Like notifications": "Like notifications",
  "Comment notifications": "Comment notifications",
  "Follow notifications": "Follow notifications",
  "Message notifications": "Message notifications",

  "Save changes": "Save changes",
  "Changes saved": "Changes saved",

  Upload: "Upload",
  "Upload video": "Upload video",
  "Add caption": "Add caption",
  "Share Loop": "Share Loop",
  "Delete Loop": "Delete Loop",

  "Are you sure?": "Are you sure?",
  "Something went wrong": "Something went wrong",
  "Try again": "Try again",
  "Loading...": "Loading...",
};

const ta: TranslationMap = {
  Home: "முகப்பு",
  Chat: "அரட்டை",
  Messages: "செய்திகள்",
  Notifications: "அறிவிப்புகள்",
  Profile: "சுயவிவரம்",
  Settings: "அமைப்புகள்",
  Search: "தேடல்",
  Loop: "லூப்",
  Saved: "சேமித்தவை",
  Explore: "ஆராயுங்கள்",
  Following: "பின்தொடர்பவை",
  Followers: "பின்தொடர்பவர்கள்",
  Follow: "பின்தொடர்",
  Unfollow: "பின்தொடர்வதை நிறுத்து",
  Like: "விருப்பம்",
  Comment: "கருத்து",
  Share: "பகிர்",
  Save: "சேமி",
  Send: "அனுப்பு",
  Post: "பதிவு",
  Posts: "பதிவுகள்",
  Create: "உருவாக்கு",
  Edit: "திருத்து",
  Delete: "நீக்கு",
  Cancel: "ரத்து",
  Done: "முடிந்தது",
  Close: "மூடு",
  Back: "பின்செல்",
  Next: "அடுத்து",
  More: "மேலும்",

  "No notifications yet": "இன்னும் அறிவிப்புகள் இல்லை",
  "No messages yet": "இன்னும் செய்திகள் இல்லை",
  "No posts yet": "இன்னும் பதிவுகள் இல்லை",
  "No saved Loops yet": "இன்னும் சேமித்த லூப்கள் இல்லை",

  "Search people": "மக்களைத் தேடு",
  "Search messages": "செய்திகளைத் தேடு",
  "Write a message": "செய்தி எழுதுங்கள்",
  "Write something...": "ஏதாவது எழுதுங்கள்...",
  "What's happening?": "என்ன நடக்கிறது?",
  "Add a comment...": "கருத்தைச் சேர்க்கவும்...",
  "Start a conversation": "உரையாடலைத் தொடங்கு",

  "Your activity": "உங்கள் செயல்பாடு",
  "Privacy & Safety": "தனியுரிமை மற்றும் பாதுகாப்பு",
  "Language & Region": "மொழி மற்றும் பகுதி",
  Appearance: "தோற்றம்",
  Security: "பாதுகாப்பு",
  Account: "கணக்கு",
  Privacy: "தனியுரிமை",
  "Data & Media": "தரவு மற்றும் மீடியா",
  "Help & Support": "உதவி மற்றும் ஆதரவு",
  "About Inaivu": "இணைவு பற்றி",

  Logout: "வெளியேறு",
  "Log out": "வெளியேறு",
  "Edit profile": "சுயவிவரத்தைத் திருத்து",

  Online: "ஆன்லைன்",
  Offline: "ஆஃப்லைன்",
  "Active now": "இப்போது செயலில்",
  You: "நீங்கள்",

  System: "சிஸ்டம்",
  Light: "வெளிச்சம்",
  Dark: "இருள்",

  Language: "மொழி",
  English: "ஆங்கிலம்",
  Tamil: "தமிழ்",
  "Change language": "மொழியை மாற்று",
  "Choose your language": "உங்கள் மொழியைத் தேர்வு செய்யுங்கள்",

  Public: "பொது",
  "Followers only": "பின்தொடர்பவர்களுக்கு மட்டும்",
  Private: "தனிப்பட்டது",

  "Show online status": "ஆன்லைன் நிலையை காட்டு",
  "Allow messages": "செய்திகளை அனுமதி",

  "Notification settings": "அறிவிப்பு அமைப்புகள்",
  "Like notifications": "விருப்ப அறிவிப்புகள்",
  "Comment notifications": "கருத்து அறிவிப்புகள்",
  "Follow notifications": "பின்தொடர்வு அறிவிப்புகள்",
  "Message notifications": "செய்தி அறிவிப்புகள்",

  "Save changes": "மாற்றங்களைச் சேமி",
  "Changes saved": "மாற்றங்கள் சேமிக்கப்பட்டன",

  Upload: "பதிவேற்று",
  "Upload video": "வீடியோவைப் பதிவேற்று",
  "Add caption": "விளக்கத்தைச் சேர்",
  "Share Loop": "லூப்பைப் பகிர்",
  "Delete Loop": "லூப்பை நீக்கு",

  "Are you sure?": "நிச்சயமாகவா?",
  "Something went wrong": "ஏதோ தவறு ஏற்பட்டது",
  "Try again": "மீண்டும் முயற்சி செய்",
  "Loading...": "ஏற்றப்படுகிறது...",
};

const hi: TranslationMap = {
  Home: "होम",
  Chat: "चैट",
  Messages: "संदेश",
  Notifications: "सूचनाएँ",
  Profile: "प्रोफ़ाइल",
  Settings: "सेटिंग्स",
  Search: "खोजें",
  Loop: "लूप",
  Saved: "सहेजे गए",
  Explore: "एक्सप्लोर",
  Following: "फ़ॉलो कर रहे हैं",
  Followers: "फ़ॉलोअर्स",
  Follow: "फ़ॉलो करें",
  Unfollow: "अनफ़ॉलो करें",
  Like: "पसंद",
  Comment: "टिप्पणी",
  Share: "शेयर",
  Save: "सहेजें",
  Send: "भेजें",
  Post: "पोस्ट",
  Posts: "पोस्ट",
  Create: "बनाएँ",
  Edit: "संपादित करें",
  Delete: "हटाएँ",
  Cancel: "रद्द करें",
  Done: "हो गया",
  Close: "बंद करें",
  Back: "वापस",
  Next: "अगला",
  More: "और",

  "No notifications yet": "अभी कोई सूचनाएँ नहीं हैं",
  "No messages yet": "अभी कोई संदेश नहीं है",
  "No posts yet": "अभी कोई पोस्ट नहीं है",
  "No saved Loops yet": "अभी कोई सहेजे गए लूप नहीं हैं",

  "Search people": "लोगों को खोजें",
  "Search messages": "संदेश खोजें",
  "Write a message": "संदेश लिखें",
  "Write something...": "कुछ लिखें...",
  "What's happening?": "क्या हो रहा है?",
  "Add a comment...": "टिप्पणी जोड़ें...",
  "Start a conversation": "बातचीत शुरू करें",

  "Your activity": "आपकी गतिविधि",
  "Privacy & Safety": "गोपनीयता और सुरक्षा",
  "Language & Region": "भाषा और क्षेत्र",
  Appearance: "दिखावट",
  Security: "सुरक्षा",
  Account: "खाता",
  Privacy: "गोपनीयता",
  "Data & Media": "डेटा और मीडिया",
  "Help & Support": "मदद और सहायता",
  "About Inaivu": "इनैवु के बारे में",

  Logout: "लॉग आउट",
  "Log out": "लॉग आउट",
  "Edit profile": "प्रोफ़ाइल संपादित करें",

  Online: "ऑनलाइन",
  Offline: "ऑफ़लाइन",
  "Active now": "अभी सक्रिय",
  You: "आप",

  System: "सिस्टम",
  Light: "लाइट",
  Dark: "डार्क",

  Language: "भाषा",
  English: "अंग्रेज़ी",
  Tamil: "तमिल",
  "Change language": "भाषा बदलें",
  "Choose your language": "अपनी भाषा चुनें",

  Public: "सार्वजनिक",
  "Followers only": "केवल फ़ॉलोअर्स",
  Private: "निजी",

  "Show online status": "ऑनलाइन स्थिति दिखाएँ",
  "Allow messages": "संदेशों की अनुमति दें",

  "Notification settings": "सूचना सेटिंग्स",
  "Like notifications": "पसंद सूचनाएँ",
  "Comment notifications": "टिप्पणी सूचनाएँ",
  "Follow notifications": "फ़ॉलो सूचनाएँ",
  "Message notifications": "संदेश सूचनाएँ",

  "Save changes": "बदलाव सहेजें",
  "Changes saved": "बदलाव सहेजे गए",

  Upload: "अपलोड",
  "Upload video": "वीडियो अपलोड करें",
  "Add caption": "कैप्शन जोड़ें",
  "Share Loop": "लूप शेयर करें",
  "Delete Loop": "लूप हटाएँ",

  "Are you sure?": "क्या आप निश्चित हैं?",
  "Something went wrong": "कुछ गलत हो गया",
  "Try again": "फिर से कोशिश करें",
  "Loading...": "लोड हो रहा है...",
};

const te: TranslationMap = {
  Home: "హోమ్",
  Chat: "చాట్",
  Messages: "సందేశాలు",
  Notifications: "నోటిఫికేషన్లు",
  Profile: "ప్రొఫైల్",
  Settings: "సెట్టింగ్స్",
  Search: "వెతకండి",
  Loop: "లూప్",
  Saved: "సేవ్ చేసినవి",
  Explore: "ఎక్స్‌ప్లోర్",
  Following: "ఫాలో అవుతున్నవి",
  Followers: "ఫాలోవర్లు",
  Follow: "ఫాలో",
  Unfollow: "అన్‌ఫాలో",
  Like: "లైక్",
  Comment: "కామెంట్",
  Share: "షేర్",
  Save: "సేవ్",
  Send: "పంపు",
  Post: "పోస్ట్",
  Posts: "పోస్టులు",
  Create: "సృష్టించు",
  Edit: "ఎడిట్",
  Delete: "తొలగించు",
  Cancel: "రద్దు",
  Done: "పూర్తయింది",
  Close: "మూసివేయి",
  Back: "వెనుకకు",
  Next: "తర్వాత",
  More: "మరిన్ని",

  "No notifications yet": "ఇంకా నోటిఫికేషన్లు లేవు",
  "No messages yet": "ఇంకా సందేశాలు లేవు",
  "No posts yet": "ఇంకా పోస్టులు లేవు",
  "No saved Loops yet": "ఇంకా సేవ్ చేసిన లూప్‌లు లేవు",

  "Search people": "వ్యక్తులను వెతకండి",
  "Search messages": "సందేశాలను వెతకండి",
  "Write a message": "సందేశం రాయండి",
  "Write something...": "ఏదైనా రాయండి...",
  "What's happening?": "ఏం జరుగుతోంది?",
  "Add a comment...": "కామెంట్ జోడించండి...",
  "Start a conversation": "సంభాషణను ప్రారంభించండి",

  "Your activity": "మీ కార్యకలాపం",
  "Privacy & Safety": "గోప్యత మరియు భద్రత",
  "Language & Region": "భాష మరియు ప్రాంతం",
  Appearance: "రూపం",
  Security: "భద్రత",
  Account: "ఖాతా",
  Privacy: "గోప్యత",
  "Data & Media": "డేటా మరియు మీడియా",
  "Help & Support": "సహాయం మరియు మద్దతు",
  "About Inaivu": "ఇనైవు గురించి",

  Logout: "లాగ్ అవుట్",
  "Log out": "లాగ్ అవుట్",
  "Edit profile": "ప్రొఫైల్ ఎడిట్ చేయండి",

  Online: "ఆన్‌లైన్",
  Offline: "ఆఫ్‌లైన్",
  "Active now": "ఇప్పుడు యాక్టివ్",
  You: "మీరు",

  System: "సిస్టమ్",
  Light: "లైట్",
  Dark: "డార్క్",

  Language: "భాష",
  English: "ఇంగ్లీష్",
  Tamil: "తమిళం",
  "Change language": "భాష మార్చండి",
  "Choose your language": "మీ భాషను ఎంచుకోండి",

  Public: "పబ్లిక్",
  "Followers only": "ఫాలోవర్లకు మాత్రమే",
  Private: "ప్రైవేట్",

  "Show online status": "ఆన్‌లైన్ స్థితిని చూపించు",
  "Allow messages": "సందేశాలను అనుమతించు",

  "Notification settings": "నోటిఫికేషన్ సెట్టింగ్స్",
  "Like notifications": "లైక్ నోటిఫికేషన్లు",
  "Comment notifications": "కామెంట్ నోటిఫికేషన్లు",
  "Follow notifications": "ఫాలో నోటిఫికేషన్లు",
  "Message notifications": "సందేశ నోటిఫికేషన్లు",

  "Save changes": "మార్పులను సేవ్ చేయండి",
  "Changes saved": "మార్పులు సేవ్ చేయబడ్డాయి",

  Upload: "అప్‌లోడ్",
  "Upload video": "వీడియో అప్‌లోడ్ చేయండి",
  "Add caption": "క్యాప్షన్ జోడించండి",
  "Share Loop": "లూప్ షేర్ చేయండి",
  "Delete Loop": "లూప్ తొలగించండి",

  "Are you sure?": "మీరు ఖచ్చితంగా ఉన్నారా?",
  "Something went wrong": "ఏదో తప్పు జరిగింది",
  "Try again": "మళ్లీ ప్రయత్నించండి",
  "Loading...": "లోడ్ అవుతోంది...",
};

const kn: TranslationMap = {
  Home: "ಮುಖಪುಟ",
  Chat: "ಚಾಟ್",
  Messages: "ಸಂದೇಶಗಳು",
  Notifications: "ಅಧಿಸೂಚನೆಗಳು",
  Profile: "ಪ್ರೊಫೈಲ್",
  Settings: "ಸೆಟ್ಟಿಂಗ್ಸ್",
  Search: "ಹುಡುಕಿ",
  Loop: "ಲೂಪ್",
  Saved: "ಉಳಿಸಿದವು",
  Explore: "ಅನ್ವೇಷಿಸಿ",
  Following: "ಫಾಲೋ ಮಾಡುತ್ತಿರುವವರು",
  Followers: "ಫಾಲೋವರ್ಸ್",
  Follow: "ಫಾಲೋ",
  Unfollow: "ಅನ್‌ಫಾಲೋ",
  Like: "ಲೈಕ್",
  Comment: "ಕಾಮೆಂಟ್",
  Share: "ಹಂಚಿಕೊಳ್ಳಿ",
  Save: "ಉಳಿಸಿ",
  Send: "ಕಳುಹಿಸಿ",
  Post: "ಪೋಸ್ಟ್",
  Posts: "ಪೋಸ್ಟ್‌ಗಳು",
  Create: "ರಚಿಸಿ",
  Edit: "ತಿದ್ದು",
  Delete: "ಅಳಿಸಿ",
  Cancel: "ರದ್ದು",
  Done: "ಮುಗಿದಿದೆ",
  Close: "ಮುಚ್ಚಿ",
  Back: "ಹಿಂದೆ",
  Next: "ಮುಂದೆ",
  More: "ಇನ್ನಷ್ಟು",

  "No notifications yet": "ಇನ್ನೂ ಅಧಿಸೂಚನೆಗಳಿಲ್ಲ",
  "No messages yet": "ಇನ್ನೂ ಸಂದೇಶಗಳಿಲ್ಲ",
  "No posts yet": "ಇನ್ನೂ ಪೋಸ್ಟ್‌ಗಳಿಲ್ಲ",
  "No saved Loops yet": "ಇನ್ನೂ ಉಳಿಸಿದ ಲೂಪ್‌ಗಳಿಲ್ಲ",

  "Search people": "ಜನರನ್ನು ಹುಡುಕಿ",
  "Search messages": "ಸಂದೇಶಗಳನ್ನು ಹುಡುಕಿ",
  "Write a message": "ಸಂದೇಶ ಬರೆಯಿರಿ",
  "Write something...": "ಏನಾದರೂ ಬರೆಯಿರಿ...",
  "What's happening?": "ಏನು ನಡೆಯುತ್ತಿದೆ?",
  "Add a comment...": "ಕಾಮೆಂಟ್ ಸೇರಿಸಿ...",
  "Start a conversation": "ಸಂಭಾಷಣೆಯನ್ನು ಪ್ರಾರಂಭಿಸಿ",

  "Your activity": "ನಿಮ್ಮ ಚಟುವಟಿಕೆ",
  "Privacy & Safety": "ಗೌಪ್ಯತೆ ಮತ್ತು ಸುರಕ್ಷತೆ",
  "Language & Region": "ಭಾಷೆ ಮತ್ತು ಪ್ರದೇಶ",
  Appearance: "ರೂಪ",
  Security: "ಭದ್ರತೆ",
  Account: "ಖಾತೆ",
  Privacy: "ಗೌಪ್ಯತೆ",
  "Data & Media": "ಡೇಟಾ ಮತ್ತು ಮೀಡಿಯಾ",
  "Help & Support": "ಸಹಾಯ ಮತ್ತು ಬೆಂಬಲ",
  "About Inaivu": "ಇನೈವು ಬಗ್ಗೆ",

  Logout: "ಲಾಗ್ ಔಟ್",
  "Log out": "ಲಾಗ್ ಔಟ್",
  "Edit profile": "ಪ್ರೊಫೈಲ್ ತಿದ್ದು",

  Online: "ಆನ್‌ಲೈನ್",
  Offline: "ಆಫ್‌ಲೈನ್",
  "Active now": "ಈಗ ಸಕ್ರಿಯ",
  You: "ನೀವು",

  System: "ಸಿಸ್ಟಮ್",
  Light: "ಲೈಟ್",
  Dark: "ಡಾರ್ಕ್",

  Language: "ಭಾಷೆ",
  English: "ಇಂಗ್ಲಿಷ್",
  Tamil: "ತಮಿಳು",
  "Change language": "ಭಾಷೆ ಬದಲಿಸಿ",
  "Choose your language": "ನಿಮ್ಮ ಭಾಷೆಯನ್ನು ಆಯ್ಕೆಮಾಡಿ",

  Public: "ಸಾರ್ವಜನಿಕ",
  "Followers only": "ಫಾಲೋವರ್ಸ್ ಮಾತ್ರ",
  Private: "ಖಾಸಗಿ",

  "Show online status": "ಆನ್‌ಲೈನ್ ಸ್ಥಿತಿ ತೋರಿಸಿ",
  "Allow messages": "ಸಂದೇಶಗಳನ್ನು ಅನುಮತಿಸಿ",

  "Notification settings": "ಅಧಿಸೂಚನೆ ಸೆಟ್ಟಿಂಗ್ಸ್",
  "Like notifications": "ಲೈಕ್ ಅಧಿಸೂಚನೆಗಳು",
  "Comment notifications": "ಕಾಮೆಂಟ್ ಅಧಿಸೂಚನೆಗಳು",
  "Follow notifications": "ಫಾಲೋ ಅಧಿಸೂಚನೆಗಳು",
  "Message notifications": "ಸಂದೇಶ ಅಧಿಸೂಚನೆಗಳು",

  "Save changes": "ಬದಲಾವಣೆಗಳನ್ನು ಉಳಿಸಿ",
  "Changes saved": "ಬದಲಾವಣೆಗಳು ಉಳಿಸಲಾಗಿದೆ",

  Upload: "ಅಪ್‌ಲೋಡ್",
  "Upload video": "ವೀಡಿಯೊ ಅಪ್‌ಲೋಡ್ ಮಾಡಿ",
  "Add caption": "ಕ್ಯಾಪ್ಶನ್ ಸೇರಿಸಿ",
  "Share Loop": "ಲೂಪ್ ಹಂಚಿಕೊಳ್ಳಿ",
  "Delete Loop": "ಲೂಪ್ ಅಳಿಸಿ",

  "Are you sure?": "ನೀವು ಖಚಿತವೇ?",
  "Something went wrong": "ಏನೋ ತಪ್ಪಾಗಿದೆ",
  "Try again": "ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ",
  "Loading...": "ಲೋಡ್ ಆಗುತ್ತಿದೆ...",
};

const ml: TranslationMap = {
  Home: "ഹോം",
  Chat: "ചാറ്റ്",
  Messages: "സന്ദേശങ്ങൾ",
  Notifications: "അറിയിപ്പുകൾ",
  Profile: "പ്രൊഫൈൽ",
  Settings: "ക്രമീകരണങ്ങൾ",
  Search: "തിരയുക",
  Loop: "ലൂപ്പ്",
  Saved: "സേവ് ചെയ്തത്",
  Explore: "പര്യവേക്ഷണം",
  Following: "ഫോളോ ചെയ്യുന്നത്",
  Followers: "ഫോളോവേഴ്സ്",
  Follow: "ഫോളോ",
  Unfollow: "അൺഫോളോ",
  Like: "ലൈക്ക്",
  Comment: "കമന്റ്",
  Share: "പങ്കിടുക",
  Save: "സേവ്",
  Send: "അയയ്ക്കുക",
  Post: "പോസ്റ്റ്",
  Posts: "പോസ്റ്റുകൾ",
  Create: "സൃഷ്ടിക്കുക",
  Edit: "എഡിറ്റ്",
  Delete: "ഇല്ലാതാക്കുക",
  Cancel: "റദ്ദാക്കുക",
  Done: "പൂർത്തിയായി",
  Close: "അടയ്ക്കുക",
  Back: "തിരികെ",
  Next: "അടുത്തത്",
  More: "കൂടുതൽ",

  "No notifications yet": "ഇതുവരെ അറിയിപ്പുകളില്ല",
  "No messages yet": "ഇതുവരെ സന്ദേശങ്ങളില്ല",
  "No posts yet": "ഇതുവരെ പോസ്റ്റുകളില്ല",
  "No saved Loops yet": "ഇതുവരെ സേവ് ചെയ്ത ലൂപ്പുകളില്ല",

  "Search people": "ആളുകളെ തിരയുക",
  "Search messages": "സന്ദേശങ്ങൾ തിരയുക",
  "Write a message": "സന്ദേശം എഴുതുക",
  "Write something...": "എന്തെങ്കിലും എഴുതുക...",
  "What's happening?": "എന്താണ് സംഭവിക്കുന്നത്?",
  "Add a comment...": "കമന്റ് ചേർക്കുക...",
  "Start a conversation": "സംഭാഷണം ആരംഭിക്കുക",

  "Your activity": "നിങ്ങളുടെ പ്രവർത്തനം",
  "Privacy & Safety": "സ്വകാര്യതയും സുരക്ഷയും",
  "Language & Region": "ഭാഷയും പ്രദേശവും",
  Appearance: "രൂപം",
  Security: "സുരക്ഷ",
  Account: "അക്കൗണ്ട്",
  Privacy: "സ്വകാര്യത",
  "Data & Media": "ഡാറ്റയും മീഡിയയും",
  "Help & Support": "സഹായവും പിന്തുണയും",
  "About Inaivu": "ഇനൈവുവിനെക്കുറിച്ച്",

  Logout: "ലോഗ് ഔട്ട്",
  "Log out": "ലോഗ് ഔട്ട്",
  "Edit profile": "പ്രൊഫൈൽ എഡിറ്റ് ചെയ്യുക",

  Online: "ഓൺലൈൻ",
  Offline: "ഓഫ്‌ലൈൻ",
  "Active now": "ഇപ്പോൾ സജീവം",
  You: "നിങ്ങൾ",

  System: "സിസ്റ്റം",
  Light: "ലൈറ്റ്",
  Dark: "ഡാർക്ക്",

  Language: "ഭാഷ",
  English: "ഇംഗ്ലീഷ്",
  Tamil: "തമിഴ്",
  "Change language": "ഭാഷ മാറ്റുക",
  "Choose your language": "നിങ്ങളുടെ ഭാഷ തിരഞ്ഞെടുക്കുക",

  Public: "പൊതു",
  "Followers only": "ഫോളോവേഴ്സിന് മാത്രം",
  Private: "സ്വകാര്യം",

  "Show online status": "ഓൺലൈൻ നില കാണിക്കുക",
  "Allow messages": "സന്ദേശങ്ങൾ അനുവദിക്കുക",

  "Notification settings": "അറിയിപ്പ് ക്രമീകരണങ്ങൾ",
  "Like notifications": "ലൈക്ക് അറിയിപ്പുകൾ",
  "Comment notifications": "കമന്റ് അറിയിപ്പുകൾ",
  "Follow notifications": "ഫോളോ അറിയിപ്പുകൾ",
  "Message notifications": "സന്ദേശ അറിയിപ്പുകൾ",

  "Save changes": "മാറ്റങ്ങൾ സേവ് ചെയ്യുക",
  "Changes saved": "മാറ്റങ്ങൾ സേവ് ചെയ്തു",

  Upload: "അപ്‌ലോഡ്",
  "Upload video": "വീഡിയോ അപ്‌ലോഡ് ചെയ്യുക",
  "Add caption": "ക്യാപ്ഷൻ ചേർക്കുക",
  "Share Loop": "ലൂപ്പ് പങ്കിടുക",
  "Delete Loop": "ലൂപ്പ് ഇല്ലാതാക്കുക",

  "Are you sure?": "നിങ്ങൾക്ക് ഉറപ്പാണോ?",
  "Something went wrong": "എന്തോ തെറ്റായി",
  "Try again": "വീണ്ടും ശ്രമിക്കുക",
  "Loading...": "ലോഡ് ചെയ്യുന്നു...",
};

export const translations: Record<
  LanguageCode,
  TranslationMap
> = {
  en,
  ta,
  hi,
  te,
  kn,
  ml,

  /*
   * These languages currently fall back
   * to English until their complete
   * dictionaries are added.
   */
  bn: en,
  mr: en,
  gu: en,
  pa: en,
  ur: en,
  zh: en,
  ja: en,
  ko: en,
  es: en,
  fr: en,
  de: en,
  pt: en,
  ru: en,
  ar: en,

  auto: en,
};

export function getBrowserLanguage(): LanguageCode {
  if (typeof navigator === "undefined") {
    return "en";
  }

  const browserLanguage =
    navigator.language.toLowerCase();

  if (browserLanguage.startsWith("ta")) {
    return "ta";
  }

  if (browserLanguage.startsWith("hi")) {
    return "hi";
  }

  if (browserLanguage.startsWith("te")) {
    return "te";
  }

  if (browserLanguage.startsWith("kn")) {
    return "kn";
  }

  if (browserLanguage.startsWith("ml")) {
    return "ml";
  }

  if (browserLanguage.startsWith("bn")) {
    return "bn";
  }

  if (browserLanguage.startsWith("mr")) {
    return "mr";
  }

  if (browserLanguage.startsWith("gu")) {
    return "gu";
  }

  if (browserLanguage.startsWith("pa")) {
    return "pa";
  }

  if (browserLanguage.startsWith("ur")) {
    return "ur";
  }

  if (browserLanguage.startsWith("zh")) {
    return "zh";
  }

  if (browserLanguage.startsWith("ja")) {
    return "ja";
  }

  if (browserLanguage.startsWith("ko")) {
    return "ko";
  }

  if (browserLanguage.startsWith("es")) {
    return "es";
  }

  if (browserLanguage.startsWith("fr")) {
    return "fr";
  }

  if (browserLanguage.startsWith("de")) {
    return "de";
  }

  if (browserLanguage.startsWith("pt")) {
    return "pt";
  }

  if (browserLanguage.startsWith("ru")) {
    return "ru";
  }

  if (browserLanguage.startsWith("ar")) {
    return "ar";
  }

  return "en";
}

export function getTranslation(
  language: LanguageCode,
  value: string,
): string {
  const actualLanguage =
    language === "auto"
      ? getBrowserLanguage()
      : language;

  return (
    translations[actualLanguage]?.[value] ??
    value
  );
}