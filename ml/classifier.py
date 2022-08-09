import cv2
import subprocess
import numpy as np
import tensorflow as tf
import ffmpeg
import imageio.v3 as iio
import os

def process_video(f, face_detector, model):
    # vid = cv2.VideoCapture(f)
    # w, h = vid.get(3), vid.get(4)
    # file = 'tempfile.mp4'
    # ffmpeg.output(f, file)
    frames = []
    print('shape of video: ', iio.imread(f, index=None, extension='.mp4').shape)
    # w = iio.get_writer('my_video.mp4', format='FFMPEG', mode='I', fps=1,
    #                    codec='h264_vaapi',
    #                    output_params=['-vaapi_device',
    #                                   '/dev/dri/renderD128',
    #                                   '-vf',
    #                                   'format=gray|nv12,hwupload'],
    #                    pixelformat='vaapi_vld')
    for frame in iio.imread(f, index=None, extension='.mp4'):
        frames.append(classify_frame(np.array(frame)[0], face_detector, model))
    frames = np.concatenate(frames)
    print('shape of stack: ', frames.shape)
    # iio.imwrite(file, frames)
    # subprocess.run(['chmod', '+x', 'ml/FaceLandmarkVid.exe'])
    # subprocess.run(['ml/FaceLandmarkVid.exe', '-f', file, '-mloc', 'ml/main_clm_general.txt'])
    # subprocess.run(['rm', file])
    return iio.imwrite("<bytes>", frames, extension=".mp4")

def classify_frame(frame, face_detector, model):

    # print(frame.shape)

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