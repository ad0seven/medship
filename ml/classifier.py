import gc
import cv2
import numpy as np
import tensorflow as tf
import imageio.v3 as iio

def process_video(f, face_detector, model):
    
    # Process frame by frame
    frames = []
    emotions = ('angry', 'disgust', 'fear', 'happy', 'sad', 'surprise', 'neutral')

    for frame in iio.imiter(f, extension=".webm"):
        frame = np.array(frame)
        print('FRAME SHAPE', frame.shape)
        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        detected_faces = face_detector.detectMultiScale(gray, scaleFactor=1.2, minNeighbors=10, minSize=(5, 5), flags=cv2.CASCADE_SCALE_IMAGE)

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
                
                cv2.putText(frame, label + " : " + str(confidence), (int(x), int(y)), cv2.FONT_HERSHEY_SIMPLEX, 1, (255, 255, 255), 2)

        frames.append(frame)

        # Clean data
        del gray 
        del img
        del adjust_img
        del img_tensor
        del frame
        del detected_faces
        del label
        del confidence
        del predictions
        gc.collect()

    del emotions

    return iio.imwrite("<bytes>", np.stack(frames), extension=".webm", fps=30)

def classify_frame(frame, face_detector, model):

    #
    emotions = ('angry', 'disgust', 'fear', 'happy', 'sad', 'surprise', 'neutral')
    gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
    detected_faces = face_detector.detectMultiScale(gray, scaleFactor=1.2, minNeighbors=10, minSize=(5, 5), flags=cv2.CASCADE_SCALE_IMAGE)

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
            
            cv2.putText(frame, label + " : " + str(confidence), (int(x), int(y)), cv2.FONT_HERSHEY_SIMPLEX, 1, (255, 255, 255), 2)

    # Clean data
    gray = None
    img = None
    adjust_img = None
    img_tensor = None
        
    return frame


def classify(frame, face_detector, model):

    print(frame.shape)

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
        
    cv2.imwrite("somefile.jpeg", frame)

    return face_prop