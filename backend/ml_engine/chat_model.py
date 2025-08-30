import re
import random
import urllib.parse
import wikipedia
from datetime import datetime

def normalize(s: str) -> str:
    return re.sub(r'\s+', ' ', (s or '').strip().lower())

def detect_language(text: str) -> str:
    msg = normalize(text)
    has_devanagari = bool(re.search(r'[\u0900-\u097F]', msg))
    hinglish_tokens = {
        'kya','hai','ka','tum','mera','tera','krna','krta','krte','nahi','mat',
        'kar','karo','krdo','kr diya','kr de'
    }
    latin_tokens = set(re.findall(r'\b[a-z]+\b', msg))
    score = len(latin_tokens & hinglish_tokens)
    if has_devanagari and score >= 1:
        return "hindi"
    if has_devanagari:
        return "hindi"
    if score >= 2:
        return "hinglish"
    return "english"

def token_match(msg: str, kw: str) -> bool:
    if ' ' in kw or re.search(r'[\u0900-\u097F]', kw):
        return kw.lower() in msg
    return re.search(r'\b' + re.escape(kw.lower()) + r'\b', msg) is not None

def strip_first_keyword(message: str, keywords):
    msg = normalize(message)
    ordered = sorted(((k or '').strip().lower() for k in keywords if k), key=len, reverse=True)
    for kw in ordered:
        if not kw:
            continue
        if ' ' in kw or re.search(r'[\u0900-\u097F]', kw):
            pattern = r'(?<!\S)' + re.escape(kw) + r'(?!\S)'
        else:
            pattern = r'\b' + re.escape(kw) + r'\b'
        new_msg, n = re.subn(pattern, '', msg, count=1)
        if n:
            return normalize(new_msg)
    return msg

def url_encode(q: str) -> str:
    return urllib.parse.quote_plus(q)

def wikipedia_summary(query: str, lang_code="en"):
    if not query:
        return False, "Please provide a topic to search on Wikipedia."
    try:
        wikipedia.set_lang(lang_code)
        return True, wikipedia.summary(query, sentences=2, auto_suggest=True, redirect=True)
    except wikipedia.DisambiguationError as e:
        return False, f"That topic is ambiguous. Try: {', '.join(e.options[:5])}."
    except wikipedia.PageError:
        try:
            return True, wikipedia.summary(query, sentences=2, auto_suggest=True)
        except Exception:
            return False, "Sorry, I couldn't find that topic on Wikipedia."
    except Exception:
        return False, "Wikipedia lookup failed. Please try again."

def simple_sentiment(text: str) -> str:
    msg = normalize(text)
    neg = any(w in msg for w in ["bad","angry","upset","ghussa","bura","worst","hate","bakwas","बेकार","गुस्सा"])
    pos = any(w in msg for w in ["good","great","awesome","shukriya","thanks","thank you","धन्यवाद","अच्छा"])
    if neg and not pos:
        return "negative"
    if pos and not neg:
        return "positive"
    return "neutral"

INTENTS = [
    {"name":"greeting","keywords":["hello","hi","hey","नमस्ते","हैलो","नमस्कार"],
     "responses":[ "Hello! How can I help today?", "नमस्ते! मैं आपकी कैसे सहायता कर सकता हूँ?" ]},

    {"name":"youtube_open","keywords":["open youtube","youtube kholo","यूट्यूब खोलो"],
     "url":"https://www.youtube.com","responses":["Opening YouTube…","यूट्यूब खोल रहा हूँ…"]},

    {"name":"youtube_search","keywords":["search on youtube","youtube search","play","search on", "चलाओ"],
     "action":"act_youtube_search"},

    {"name":"google_search","keywords":["search on google","google search","google"],
     "action":"act_google_search"},

    {"name":"wikipedia_search","keywords":["search on wikipedia","wikipedia search","wikipedia","विकिपीडिया"],
     "action":"act_wikipedia"},

    {"name":"weather","keywords":["weather","मौसम","mausam"],"action":"act_weather"},
    {"name":"time","keywords":["time","समय","kitna baja","what time"],"action":"act_time"},
    {"name":"thanks","keywords":["thanks","thank you","shukriya","धन्यवाद"],
     "responses":["You're welcome!","खुशी हुई मदद करके!"]},
    {"name":"joke","keywords":["joke","मज़ाक","joke सुनाओ"],
     "responses":["Why don't skeletons fight each other? They don't have the guts!",
                  "टीचर: तुम्हारा नाम क्या है? छात्र: WhatsApp पे वही है, वहीं देख लो!"]},
    {"name":"help","keywords":["help","madad","सहायता"],
     "responses":[ "I can search Google/YouTube/Wikipedia, tell a joke, check weather, or show the time. What would you like?" ]},
]

def match_intent(message: str):
    msg = normalize(message)
    scores = []
    for intent in INTENTS:
        kwords = intent.get("keywords", [])
        hits = sum(1 for k in kwords if token_match(msg, k))
        if hits:
            specificity = sum(len(k) for k in kwords if token_match(msg, k))
            scores.append((hits, specificity, intent))
    if not scores:
        return None
    scores.sort(key=lambda x: (x[0], x[1]), reverse=True)
    return scores[0][2]

def act_youtube_search(message, intent, context):
    q = strip_first_keyword(message, intent["keywords"]) or context.get("last_query")
    if not q:
        return {"response":"Please tell me what to play on YouTube."}
    context["last_query"] = q
    url = f"https://www.youtube.com/results?search_query={url_encode(q)}"
    return {"response": f"Searching YouTube for '{q}'…", "url": url, "suggestions":[f"Search on Google {q}", f"Wikipedia {q}"]}

def act_google_search(message, intent, context):
    q = strip_first_keyword(message, intent["keywords"]) or context.get("last_query")
    if not q:
        return {"response":"Please tell me what to search on Google."}
    context["last_query"] = q
    url = f"https://www.google.com/search?q={url_encode(q)}"
    return {"response": f"Searching Google for '{q}'…", "url": url, "suggestions":[f"Search on YouTube {q}", f"Wikipedia {q}"]}

def act_wikipedia(message, intent, context):
    q = strip_first_keyword(message, intent["keywords"]) or context.get("last_query")
    context["last_query"] = q
    lang = detect_language(message)
    wiki_lang = "hi" if lang == "hindi" else "en"
    if not q:
        return {"response":"Please tell me a topic for Wikipedia."}
    ok, summary = wikipedia_summary(q, wiki_lang)
    return {"response": summary}

def act_weather(message, intent, context):
    msg = normalize(message)
    m = re.search(r'\b(?:weather|mausam|मौसम)\s+([a-z\u0900-\u097F\s]+)$', msg)
    if m:
        city = m.group(1).strip().title()
        context["last_query"] = city
        return {"response": f"To fetch live weather for {city}, please connect a weather API."}
    return {"response":"Please share your city to check the weather (e.g., 'weather Delhi')."}

def act_time(message, intent, context):
    now = datetime.now().strftime("%I:%M %p")
    return {"response": f"The current time is {now}."}

ACTIONS = {
    "act_youtube_search": act_youtube_search,
    "act_google_search": act_google_search,
    "act_wikipedia": act_wikipedia,
    "act_weather": act_weather,
    "act_time": act_time,
}

class ChatModelWrapper:
    def __init__(self):
        self.context = {}

    def get_response(self, msg):
        lang = detect_language(msg)
        intent = match_intent(msg)
        sentiment = simple_sentiment(msg)

        polite_prefix = ""
        if sentiment == "negative":
            polite_prefix = "I'm sorry you're feeling that way. " if lang != "hindi" else "मुझे खेद है कि आप ऐसा महसूस कर रहे हैं। "

        if intent:
            self.context["last_intent"] = intent["name"]

            if intent.get("action"):
                fn = ACTIONS.get(intent["action"])
                if callable(fn):
                    result = fn(msg, intent, self.context)
                    resp = polite_prefix + result.get("response", "")
                    return {
                        "intent": intent["name"],
                        "response": resp,
                        "url": result.get("url"),
                        "lang": lang,
                        "confidence": 0.8,
                        "suggestions": result.get("suggestions", []),
                    }

            if intent.get("url"):
                return {
                    "intent": intent["name"],
                    "response": polite_prefix + random.choice(intent.get("responses", ["Opening..."])),
                    "url": intent["url"],
                    "lang": lang,
                    "confidence": 0.9,
                }

            return {
                "intent": intent["name"],
                "response": polite_prefix + random.choice(intent.get("responses", ["Okay."])),
                "lang": lang,
                "confidence": 0.85,
            }

        last_intent = self.context.get("last_intent")
        if last_intent in ACTIONS:
            fn = ACTIONS[last_intent]
            result = fn(msg, {"name": last_intent, "keywords":[]}, self.context)
            return {
                "intent": last_intent,
                "response": polite_prefix + result.get("response", ""),
                "url": result.get("url"),
                "lang": lang,
                "confidence": 0.6,
            }

        return {
            "intent": "unknown",
            "response": polite_prefix + "I didn't understand. Can you try again?",
            "lang": lang,
            "confidence": 0.5,
        }

chat_model = ChatModelWrapper()
