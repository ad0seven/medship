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
        f, results = process_video(unp_fn, face_detector, model)

        # Upload processed version
        resource.Object(str(os.getenv('AWS_BUCKET')), fn).put(Body=f)

        # Free memory
        del f
        gc.collect()

        print('SENDING FILE ', fn) 
        return json.dumps([{
            'fn': 'https://medship.s3.amazonaws.com/{}'.format(fn),
            'results': results
        }])

#====================================================================================================
'''google sheets stuff in the main file because the way this thing is put together is a mess 🤷‍♂️'''
#====================================================================================================

from google.oauth2.service_account import Credentials
from googleapiclient.discovery import build
import time
from flask_login import current_user

from dotenv import find_dotenv, load_dotenv
from os import environ as env

# Loading env variables
ENV_FILE = find_dotenv()
if ENV_FILE:
    load_dotenv(ENV_FILE)

# load your service account credentials
# creds = Credentials.from_service_account_file('./sheet_creds.json')

# Load credentials from environment variables
credentials_info = {
    "type": env.get('G_SHEET_TYPE'),
    "project_id": env.get('G_SHEET_PROJECT_ID'),
    "private_key_id": env.get('G_SHEET_PRIVATE_KEY_ID'),
    "private_key": env.get('G_SHEET_PRIVATE_KEY'),
    "client_email": env.get('G_SHEET_CLIENT_EMAIL'),
    "client_id": env.get('G_SHEET_CLIENT_ID'),
    "auth_uri": env.get('G_SHEET_AUTH_URI'),
    "token_uri": env.get('G_SHEET_TOKEN_URI'),
    "auth_provider_x509_cert_url": env.get('G_SHEET_AUTH_PROVIDER_X509_CERT_URL'),
    "client_x509_cert_url": env.get('G_SHEET_CLIENT_X509_CERT_URL')
}

# print('CREDENTIALS INFO: ', credentials_info)

# Create credentials from the loaded information
creds = Credentials.from_service_account_info(credentials_info)

@app.route('/update-sheet', methods=['POST'])
def update_sheet():
    # print('UPDATE SHEET FUNCTION')
    try:

        try:
            #get the current username
            username = current_user.username
            # print('the username is: ', username)
        except:
            # print('cannot get username')
            username = ''

        # The ID of your Google Sheets file
        spreadsheet_id = '1K-w62wr4O4kaYkJZAqW2DqkpLRpzIB55ExnMNaMRG0w'

        service = build('sheets', 'v4', credentials=creds)
        sheet = service.spreadsheets()

        # get the data from the POST request
        data_json = request.get_json()
        test_type = data_json['test_type']

        # get the date in hh_mm_MM_DD_YYYY format 24 hour time + timezone
        test_date = time.strftime("%H:%M_%m/%d/%Y_%Z") 

        sheet_title = username + '_' + test_type + "_" + test_date  # Create a unique title using the current timestamp

        # Create a new sheet with the title
        body = {
            'requests': [{
                'addSheet': {
                    'properties': {
                        'title': sheet_title
                    }
                }
            }]
        }
        sheet.batchUpdate(spreadsheetId=spreadsheet_id, body=body).execute()

        # Create data values
        data_values = [data_json['columns']] + data_json['values']

        # generate the data
        data = [
            {
                'range': sheet_title,
                'majorDimension': 'ROWS',
                'values': data_values
            }
        ]

        body = {
            # 'valueInputOption': 'USER_ENTERED',
            'valueInputOption': 'RAW',
            'data': data
        }

        # call the Sheets API
        sheet.values().batchUpdate(spreadsheetId=spreadsheet_id, body=body).execute()

        return {'success': True, 'sheet_title': sheet_title}
    
    except Exception as e:
        print(e)
        return {'success': False, 'error': str(e)}

if DEBUG:
    app.logger.info('DEBUG       = ' + str(DEBUG))
    app.logger.info('Environment = ' + get_config_mode)
    app.logger.info('DBMS        = ' + app_config.SQLALCHEMY_DATABASE_URI)

if __name__ == "__main__":
    app.run()