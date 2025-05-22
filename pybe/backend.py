import torch
torch.set_num_threads(1)

import json, os
from flask import Flask, request, jsonify
from sentence_transformers import SentenceTransformer, util

app = Flask(__name__)
MODEL_NAME = 'snunlp/KR-SBERT-V40K-klueNLI-augSTS'

BASE_PATH = os.path.dirname(os.path.abspath(__file__))
INTENT_JSON_PATH = os.path.join(BASE_PATH, '../data/intents.json')

# --- Load model and intents at startup ---
model = SentenceTransformer(MODEL_NAME)
with open(INTENT_JSON_PATH, 'r', encoding='utf-8') as f:
    intent_data = json.load(f)

known_sentences = []
intent_map = {}
for intent, sentences in intent_data.items():
    for s in sentences:
        known_sentences.append(s)
        intent_map[s] = intent

known_embeddings = model.encode(known_sentences, convert_to_tensor=True)

# --- Similarity endpoint ---
@app.route('/similarity', methods=['POST'])
def similarity():
    data = request.json
    input_text = data.get('sentence', '')
    if not input_text:
        return jsonify({"error": "No sentence provided."}), 400

    input_embedding = model.encode(input_text, convert_to_tensor=True)
    sims = util.cos_sim(input_embedding, known_embeddings)[0]
    max_idx = sims.argmax().item()

    best_sentence = known_sentences[max_idx]
    best_score = sims[max_idx].item()

    return jsonify({
        "input": input_text,
        "matched": best_sentence,
        "intent": intent_map[best_sentence],
        "score": best_score
    })

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000)
