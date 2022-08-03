from sys import exit
from tempfile import TemporaryFile
from decouple import config
from apps import create_app, db
from flask_migrate import Migrate
from apps.config import config_dict
from github import Github
# from flask_uploads import UploadSet, configure_uploads
# from werkzeug.utils import secure_filename

import os
import cv2
import json
import numpy as np
from flask import request, Response
from ml.classifier import classify, classify_video
from keras.models import model_from_json

# WARNING: Don't run with debug turned on in production!
DEBUG = config('DEBUG', default = True, cast = bool)

# The configuration
get_config_mode = 'Debug' if DEBUG else 'Production'

try:
    app_config = config_dict[get_config_mode.capitalize()]

except KeyError:
    exit('Error: Invalid <config_mode>. Expected values [Debug, Production] ')

app = create_app(app_config)
Migrate(app, db)

# Load Haarcascade File
face_detector = cv2.CascadeClassifier(cv2.data.haarcascades + "haarcascade_frontalface_default.xml")

# Load the Model and Weights
model = model_from_json(open("ml/facial_expression_model_structure.json", "r").read())
model.load_weights('ml/facial_expression_model_weights.h5')

# Accessing Github
g = Github(str(os.getenv('GH_SECRET')))
repository = g.get_user().get_repo('medship')

@app.route('/ml_upload', methods=['POST', 'GET'])
def upload_file():
    if request.method == 'POST' and 'file' in request.files:
        f = request.files['file'].read()
        npimg = np.fromstring(f, np.uint8)
        img = cv2.imdecode(npimg, cv2.IMREAD_GRAYSCALE)
        face_properties = classify(img, face_detector, model)

        return json.dumps(face_properties)

# @app.route('/ml_upload_vid', methods=['POST', 'GET'])
# def upload_vid():
#     if request.method == 'POST' and 'vid_file' in request.files:
#         video = request.files["vid_file"]
#         # filename = secure_filename(video.filename) # Secure the filename to prevent some kinds of attack
#         # media_set.save(video, name=filename)
#         vid_properties = classify_video(video, video.filename, face_detector, model)
#         return json.dumps(vid_properties)

@app.route('/ml_upload_vid_frames', methods=['POST', 'GET'])
def upload_vid_frames():
    if request.method == 'POST' and 'vid_file' in request.files:
        print('PYTHON HAS BEEN REACHED')
        f = request.files['vid_file'].read()
        print(request.files)
        # print(f)
        print(np.frombuffer(f, np.uint8))
        print('trying to create a file')
        repository.create_file('apps/heroku-files/vid_file.webm', 'upload', f)
        return 'apps/heroku-files/vid_file.webm'

        # npimg = np.fromstring(f, np.uint8)
        # img = cv2.imdecode(npimg, cv2.IMREAD_GRAYSCALE)
        # print(img)
        # new_img = classify_video(img, face_detector, model)
        # return Response(np.frombuffer(f, np.uint8), mimetype='video/webm')
        
        # return json.dumps({'vidfile': request.files['vid_file'].read()})



if DEBUG:
    app.logger.info('DEBUG       = ' + str(DEBUG))
    app.logger.info('Environment = ' + get_config_mode)
    app.logger.info('DBMS        = ' + app_config.SQLALCHEMY_DATABASE_URI)

if __name__ == "__main__":
    app.run()