from pathlib import Path

import torch
import torch.nn as nn
from torchvision import models, datasets, transforms
from torch.utils.data import DataLoader

ROOT = Path(__file__).resolve().parents[2]
TRAIN_DIR = str(ROOT / "dataset" / "train")
VAL_DIR = str(ROOT / "dataset" / "valid")

# Transformations
transform = transforms.Compose([
    transforms.Resize((224, 224)),
    transforms.ToTensor()
])

# Load datasets
train_ds = datasets.ImageFolder(TRAIN_DIR, transform=transform)
val_ds = datasets.ImageFolder(VAL_DIR, transform=transform)

train_loader = DataLoader(train_ds, batch_size=32, shuffle=True)
val_loader = DataLoader(val_ds, batch_size=32, shuffle=False)

# Load EfficientNet
model = models.efficientnet_b0(pretrained=True)
model.classifier[1] = nn.Linear(model.classifier[1].in_features, len(train_ds.classes))

criterion = nn.CrossEntropyLoss()
optimizer = torch.optim.Adam(model.parameters(), lr=1e-4)

device = "cuda" if torch.cuda.is_available() else "cpu"
model.to(device)

# Train
for epoch in range(10):
    model.train()
    total_loss = 0

    for imgs, labels in train_loader:
        imgs, labels = imgs.to(device), labels.to(device)

        optimizer.zero_grad()
        outputs = model(imgs)
        loss = criterion(outputs, labels)
        loss.backward()
        optimizer.step()

        total_loss += loss.item()

    print(f"Epoch {epoch+1} | Loss: {total_loss:.4f}")

# Save model
_out = ROOT / "model" / "plant_model.pth"
torch.save(model.state_dict(), _out)
print(f"Training complete. Model saved at {_out}")
