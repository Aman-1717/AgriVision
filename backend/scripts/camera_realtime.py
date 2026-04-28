import os
from pathlib import Path

import cv2
import torch
from torchvision import models, transforms
import torch.nn.functional as F
from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
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

def predict_frame(frame):
    img = Image.fromarray(cv2.cvtColor(frame, cv2.COLOR_BGR2RGB))
    x = transform(img).unsqueeze(0)

    with torch.no_grad():
        probs = F.softmax(model(x), dim=1)
        conf, idx = torch.max(probs, 1)

    return CLASSES[idx.item()], float(conf.item()) * 100


# ---- Real-time camera feed ----
cap = cv2.VideoCapture(0)

while True:
    ret, frame = cap.read()
    if not ret:
        break

    disease, confidence = predict_frame(frame)

    text = f"{disease} ({confidence:.2f}%)"
    cv2.putText(frame, text, (20, 40), cv2.FONT_HERSHEY_SIMPLEX,
                1, (0, 255, 0), 2)

    cv2.imshow("Real-Time Plant Disease Detection", frame)

    if cv2.waitKey(1) & 0xFF == ord('q'):
        break

cap.release()
cv2.destroyAllWindows()
