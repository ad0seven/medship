from sys import exit
from decouple import config
from apps import create_app, db
from flask_migrate import Migrate
from apps.config import config_dict

from flask import request
# from flask_bootstrap import Bootstrap
# from flask_wtf.csrf import CSRFProtect
from werkzeug.utils import secure_filename
 
# from flask_mail import Mail
# from ml.s3 import *

# from github import Github
# from flask_uploads import UploadSet, configure_uploads
# from werkzeug.utils import secure_filename

import boto3
import random
import string
import os
import cv2
import json
import numpy as np
from flask import request
from ml.classifier import classify
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
# g = Github(str(os.getenv('GH_SECRET')))
# repository = g.get_user().get_repo('medship')

ALLOWED_EXTENSIONS = set(['webm', 'mp4'])

client = boto3.client(
    's3',
    aws_access_key_id = str(os.getenv('AWS_ACCESS')),
    aws_secret_access_key = str(os.getenv('AWS_SECRET')),
    region_name = 'us-east-1'
)
    
# Creating the high level object oriented interface
resource = boto3.resource(
    's3',
    aws_access_key_id = str(os.getenv('AWS_ACCESS')),
    aws_secret_access_key = str(os.getenv('AWS_SECRET')),
    region_name = 'us-east-1'
)
 
 
def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS


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
        # print('trying to read original file')
        # file = repository.get_contents('apps/heroku-files/vid_file.webm')
        # print('sha ', file.sha)
        # print('trying to update a file')
        # repository.update_file(path = 'apps/heroku-files/vid_file.webm', message = 'upload', content = f, sha = file.sha)

        print('trying to upload to S3')
        fn = secure_filename(''.join(random.choices(string.ascii_lowercase, k=10)) + '.webm')
        # client.upload_fileobj(f, str(os.getenv('AWS_BUCKET')), fn) 
        print(fn)
        resource.Object(str(os.getenv('AWS_BUCKET')), fn).put(Body=f)
        # client.put_object(Body=f,
        #                   Bucket='medship',
        #                   Key='vid_file.webm',
        #                   ContentType='video/webm')
        print('uploaded to s3')
        full_fn = 'https://medship.s3.amazonaws.com/{}'.format(fn)
        return json.dumps([{'fn': full_fn}])

        # npimg = np.fromstring(f, np.uint8)
        # img = cv2.imdecode(npimg, cv2.IMREAD_GRAYSCALE)
        # print(img)
        # new_img = classify_video(img, face_detector, model)
        # return Response(np.frombuffer(f, np.uint8), mimetype='video/webm')
        
        # return json.dumps({'vidfile': request.files['vid_file'].read()})

# @app.route('/upload_files_to_s3', methods=['GET', 'POST'])
# def upload_files_to_s3():
#     if request.method == 'POST':
 
#         # No file selected
#         if 'file' not in request.files:
#             flash(f' *** No files Selected', 'danger')
 
#         file_to_upload = request.files['file']
#         content_type = request.mimetype
 
#         # if empty files
#         if file_to_upload.filename == '':
#             flash(f' *** No files Selected', 'danger')
 
#         # file uploaded and check
#         if file_to_upload and allowed_file(file_to_upload.filename):
 
 
#             file_name = secure_filename(file_to_upload.filename)
 
#             print(f" *** The file name to upload is {file_name}")
#             print(f" *** The file full path  is {file_to_upload}")
 
#             bucket_name = "medship"
 
#             s3_upload_small_files(file_to_upload, bucket_name, file_name,content_type )
#             flash(f'Success - {file_to_upload} Is uploaded to {bucket_name}', 'success')
 
#         else:
#             flash(f'Allowed file type are - webm - mp4.Please upload proper formats...', 'danger')
 
#     return ''
#     # return redirect(url_for('index'))

if DEBUG:
    app.logger.info('DEBUG       = ' + str(DEBUG))
    app.logger.info('Environment = ' + get_config_mode)
    app.logger.info('DBMS        = ' + app_config.SQLALCHEMY_DATABASE_URI)

if __name__ == "__main__":
    app.run()