import os
import shutil
import random
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
source = str(ROOT / "dataset" / "full")
train_dir = str(ROOT / "dataset" / "train")
val_dir = str(ROOT / "dataset" / "valid")
test_dir = str(ROOT / "dataset" / "test")

os.makedirs(train_dir, exist_ok=True)
os.makedirs(val_dir, exist_ok=True)
os.makedirs(test_dir, exist_ok=True)

for cls in os.listdir(source):
    cls_path = os.path.join(source, cls)
    if not os.path.isdir(cls_path):
        continue

    images = os.listdir(cls_path)
    random.shuffle(images)

    n = len(images)
    train_split = int(n * 0.7)
    val_split = int(n * 0.15)
    
    train_imgs = images[:train_split]
    val_imgs = images[train_split:train_split + val_split]
    test_imgs = images[train_split + val_split:]

    for split, split_imgs in [
        (train_dir, train_imgs),
        (val_dir, val_imgs),
        (test_dir, test_imgs)
    ]:
        dest = os.path.join(split, cls)
        os.makedirs(dest, exist_ok=True)
        for img in split_imgs:
            shutil.copy(os.path.join(cls_path, img), os.path.join(dest, img))

print("Dataset splitting complete.")
