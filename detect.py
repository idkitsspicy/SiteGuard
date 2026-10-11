from ultralytics import YOLO

model = YOLO("models/best.pt")

image_path = "source_files/construction-safety.jpg"

results = model(image_path)

for result in results:

    persons = []
    helmets = []
    vests = []

    for box in result.boxes:

        class_id = int(box.cls[0])
        confidence = float(box.conf[0])
        class_name = result.names[class_id]

        x1, y1, x2, y2 = box.xyxy[0].tolist()

        detection = {
            "box": (x1, y1, x2, y2),
            "confidence": confidence
        }

        if class_name == "Person":
            persons.append(detection)

        elif class_name == "Hardhat":
            helmets.append(detection)

        elif class_name == "Safety Vest":
            vests.append(detection)

    print("\n==============================")
    print("CONSTRUCTION SAFETY ANALYSIS")
    print("==============================")

    print(f"Workers detected : {len(persons)}")
    print(f"Hardhats detected: {len(helmets)}")
    print(f"Vests detected   : {len(vests)}")