import os
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
from ml.classifier import classify
from apps.config import config_dict
from keras.models import model_from_json
from werkzeug.utils import secure_filename

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
client = boto3.client(
    's3',
    aws_access_key_id = str(os.getenv('AWS_ACCESS')),
    aws_secret_access_key = str(os.getenv('AWS_SECRET')),
    region_name = 'us-east-1'
)
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
        print('PYTHON HAS BEEN REACHED')
        f = request.files['vid_file'].read()
        print(request.files)
        print(np.frombuffer(f, np.uint8))
        print('trying to upload to S3')
        fn = secure_filename(''.join(random.choices(string.ascii_lowercase, k=10)) + '.mp4')
        print(fn)
        resource.Object(str(os.getenv('AWS_BUCKET')), fn).put(Body=f)
        print('uploaded to s3')
        full_fn = 'https://medship.s3.amazonaws.com/{}'.format(fn)
        return json.dumps([{'fn': full_fn}])

if DEBUG:
    app.logger.info('DEBUG       = ' + str(DEBUG))
    app.logger.info('Environment = ' + get_config_mode)
    app.logger.info('DBMS        = ' + app_config.SQLALCHEMY_DATABASE_URI)

if __name__ == "__main__":
    app.run()