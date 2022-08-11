import os
import gc
import cv2
import json
import boto3
import random
import string
import numpy as np

from sys import exit
from flask import request
from decouple import config
from apps import create_app, db
from flask_migrate import Migrate
from apps.config import config_dict
from keras.models import model_from_json
from werkzeug.utils import secure_filename
from ml.classifier import classify, process_video

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

# Connecting to file storage with AWS S3
resource = boto3.resource(
    's3',
    aws_access_key_id = str(os.getenv('AWS_ACCESS')),
    aws_secret_access_key = str(os.getenv('AWS_SECRET')),
    region_name = 'us-east-1'
)

@app.route('/ml_upload', methods=['POST', 'GET'])
def upload_file():
    if request.method == 'POST' and 'file' in request.files:
        f = request.files['file'].read()
        npimg = np.fromstring(f, np.uint8)
        img = cv2.imdecode(npimg, cv2.IMREAD_GRAYSCALE)
        face_properties = classify(img, face_detector, model)

        return json.dumps(face_properties)

@app.route('/ml_upload_vid', methods=['POST', 'GET'])
def upload_vid_frames():
    if request.method == 'POST' and 'vid_file' in request.files:

        # Process video frame by frame
        print('PYTHON HAS BEEN REACHED')

        # Secure a filename
        fn = secure_filename(''.join(random.choices(string.ascii_lowercase, k=10)) + '.mp4')
        unp_fn = 'unprocessed_' + fn

        # Upload unprocessed version
        f_bytes = request.files['vid_file'].read()
        resource.Object(str(os.getenv('AWS_BUCKET')), unp_fn).put(Body=f_bytes)

        # Free memory
        del f_bytes
        del request.files
        
        # Process video frame by frame
        f = process_video(unp_fn, face_detector, model)

        # Upload processed version
        resource.Object(str(os.getenv('AWS_BUCKET')), fn).put(Body=f)

        # Free memory
        del f
        gc.collect()

        print('SENDING FILE ', fn)
        return json.dumps([{'fn': 'https://medship.s3.amazonaws.com/{}'.format(fn)}])

if DEBUG:
    app.logger.info('DEBUG       = ' + str(DEBUG))
    app.logger.info('Environment = ' + get_config_mode)
    app.logger.info('DBMS        = ' + app_config.SQLALCHEMY_DATABASE_URI)

if __name__ == "__main__":
    app.run()