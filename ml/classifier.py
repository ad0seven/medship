import cv2
import numpy as np
import tensorflow as tf
import imageio.v3 as iio

def test_stream():
    print(iio.imiter('https://medship.s3.amazonaws.com/cs2/1/agitated/pt.mp4', extension='.mp4')[0])

def process_video(f, face_detector, model):
    frames = [classify_frame(np.array(frame), face_detector, model) for frame in iio.imread(f, extension='.mp4')]
    return iio.imwrite("<bytes>", np.stack(frames), extension=".mp4", fps=30)

def apply_properties(frame, properties):
    x = properties['x']
    y = properties['y']
    w = properties['w']
    h = properties['h']
    label = properties['label']
    confidence = properties['confidence']
    frame = cv2.rectangle(frame, (x, y), (x + w, y + h), (255, 0, 0), 2)
    cv2.putText(frame, label + " : " + str(confidence), (int(x), int(y)), cv2.FONT_HERSHEY_SIMPLEX, 1, (255, 255, 255), 2)
    return frame

def classify_frame(frame, face_detector, model):
    try:
        emotions = ('angry', 'disgust', 'fear', 'happy', 'sad', 'surprise', 'neutral')
        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        detected_faces = face_detector.detectMultiScale(gray, scaleFactor=1.2, minNeighbors=10, minSize=(5, 5), flags=cv2.CASCADE_SCALE_IMAGE)

        x, y, w, h = detected_faces[0]
        frame = cv2.rectangle(frame, (x, y), (x + w, y + h), (255, 0, 0), 2)
        img = cv2.rectangle(gray, (x, y), (x + w, y + h), (255, 0, 0), 2)

        adjust_img = img[y:y+h, x:x+w]
        adjust_img = cv2.resize(adjust_img, (48, 48))

        img_tensor = tf.keras.utils.img_to_array(adjust_img)
        img_tensor = np.expand_dims(img_tensor, axis=0)

        img_tensor /= 255

        predictions = model.predict(img_tensor)
        label = emotions[np.argmax(predictions)]
        confidence = np.max(predictions)*100
        
        cv2.putText(frame, label + " : " + str(confidence), (int(x), int(y)), cv2.FONT_HERSHEY_SIMPLEX, 1, (255, 255, 255), 2)
        return frame

    except:
        return frame


def classify(frame, face_detector, model):

    emotions = ('angry', 'disgust', 'fear', 'happy', 'sad', 'surprise', 'neutral')
    gray = frame
    detected_faces = face_detector.detectMultiScale(gray, scaleFactor=1.2, minNeighbors=10, minSize=(5, 5), flags=cv2.CASCADE_SCALE_IMAGE)
    face_prop = []

    if len(detected_faces) > 0:

        for (x, y, w, h) in detected_faces:
            frame = cv2.rectangle(frame, (x, y), (x + w, y + h), (255, 0, 0), 2)
            img = cv2.rectangle(gray, (x, y), (x + w, y + h), (255, 0, 0), 2)

            adjust_img = img[y:y+h, x:x+w]
            adjust_img = cv2.resize(adjust_img, (48, 48))

            img_tensor = tf.keras.utils.img_to_array(adjust_img)
            img_tensor = np.expand_dims(img_tensor, axis=0)

            img_tensor /= 255

            predictions = model.predict(img_tensor)
            label = emotions[np.argmax(predictions)]

            confidence = np.max(predictions)
            confidence *= 100

            detect = dict()
            detect['label'] = label
            detect['score'] = str(confidence).split(".")[0]
            detect['x'] = str(x)
            detect['y'] = str(y)
            detect['width'] = str(w)
            detect['height'] = str(h)

            face_prop.append(detect)
            print(face_prop)
            
            cv2.putText(frame, label + " : " + str(confidence), (int(x), int(y)), cv2.FONT_HERSHEY_SIMPLEX, 1, (255, 255, 255), 2)

    return face_prop