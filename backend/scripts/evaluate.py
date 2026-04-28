import os
from pathlib import Path

import torch
from torchvision import models, transforms
from PIL import Image
import torch.nn.functional as F

ROOT = Path(__file__).resolve().parents[2]
TEST_DIR = str(ROOT / "dataset" / "test")

CLASSES = sorted(os.listdir(ROOT / "dataset" / "train"))

model = models.efficientnet_b0(weights=None)
model.classifier[1] = torch.nn.Linear(model.classifier[1].in_features, len(CLASSES))
model.load_state_dict(torch.load(ROOT / "model" / "plant_model.pth", map_location="cpu"))
model.eval()

# Transform
transform = transforms.Compose([
    transforms.Resize((224, 224)),
    transforms.ToTensor()
])

def predict_image(img_path):
    img = Image.open(img_path).convert("RGB")
    x = transform(img).unsqueeze(0)

    with torch.no_grad():
        probs = F.softmax(model(x), dim=1)
        conf, idx = torch.max(probs, 1)

    return CLASSES[idx.item()], float(conf.item()) * 100


# ---- Full Evaluation ----
total = 0
correct = 0

for cls in os.listdir(TEST_DIR):
    folder = os.path.join(TEST_DIR, cls)

    for img_name in os.listdir(folder):
        img_path = os.path.join(folder, img_name)

        pred, _ = predict_image(img_path)
        total += 1

        if pred == cls:
            correct += 1

accuracy = (correct / total) * 100
print(f"Total Images: {total}")
print(f"Correct Predictions: {correct}")
print(f"Model Accuracy on Test Set: {accuracy:.2f}%")
