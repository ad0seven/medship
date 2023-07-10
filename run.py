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


# WARNING: Don't run with debug turned on in production!
DEBUG = config("DEBUG", default=True, cast=bool)

# The configuration
get_config_mode = "Debug" if DEBUG else "Production"

try:
    app_config = config_dict[get_config_mode.capitalize()]

except KeyError:
    exit("Error: Invalid <config_mode>. Expected values [Debug, Production] ")

app = create_app(app_config)
Migrate(app, db)


# ====================================================================================================
"""google sheets stuff in the main file because the way this thing is put together is a mess 🤷‍♂️"""
# ====================================================================================================

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

app.config["TIMEOUT"] = 200  # Set the

# load your service account credentials
# creds = Credentials.from_service_account_file('./sheet_creds.json')

# Load credentials from environment variables
credentials_info = {
    "type": env.get("G_SHEET_TYPE"),
    "project_id": env.get("G_SHEET_PROJECT_ID"),
    "private_key_id": env.get("G_SHEET_PRIVATE_KEY_ID"),
    "private_key": env.get("G_SHEET_PRIVATE_KEY"),
    "client_email": env.get("G_SHEET_CLIENT_EMAIL"),
    "client_id": env.get("G_SHEET_CLIENT_ID"),
    "auth_uri": env.get("G_SHEET_AUTH_URI"),
    "token_uri": env.get("G_SHEET_TOKEN_URI"),
    "auth_provider_x509_cert_url": env.get("G_SHEET_AUTH_PROVIDER_X509_CERT_URL"),
    "client_x509_cert_url": env.get("G_SHEET_CLIENT_X509_CERT_URL"),
}

# print('CREDENTIALS INFO: ', credentials_info)

# Create credentials from the loaded information
creds = Credentials.from_service_account_info(credentials_info)


@app.route("/update-sheet", methods=["POST"])
def update_sheet():
    # print('UPDATE SHEET FUNCTION')
    try:
        try:
            # get the current username
            username = current_user.username
            # print('the username is: ', username)
        except:
            # print('cannot get username')
            username = ""

        # The ID of your Google Sheets file
        spreadsheet_id = env.get("SPREADSHEET_ID")

        service = build("sheets", "v4", credentials=creds)
        sheet = service.spreadsheets()

        # get the data from the POST request
        data_json = request.get_json()
        test_type = data_json["test_type"]
        print(data_json)

        # get the date in hh_mm_MM_DD_YYYY format 24 hour time + timezone
        test_date = time.strftime("%H:%M_%m/%d/%Y_%Z")

        sheet_title = (
            username + "_" + test_type + "_" + test_date
        )  # Create a unique title using the current timestamp

        # Create a new sheet with the title
        body = {"requests": [{"addSheet": {"properties": {"title": sheet_title}}}]}
        sheet.batchUpdate(spreadsheetId=spreadsheet_id, body=body).execute()

        # Create data values
        data_values = [data_json["columns"]] + data_json["values"]

        # generate the data
        data = [{"range": sheet_title, "majorDimension": "ROWS", "values": data_values}]

        body = {
            # 'valueInputOption': 'USER_ENTERED',
            "valueInputOption": "RAW",
            "data": data,
        }

        # call the Sheets API
        sheet.values().batchUpdate(spreadsheetId=spreadsheet_id, body=body).execute()

        return {"success": True, "sheet_title": sheet_title}

    except Exception as e:
        print(e)
        return str(e), 500


# ====================================================================================================
"""training video generation stuff"""
# ====================================================================================================
import base64
import numpy as np
from PIL import Image
from io import BytesIO
from flask import send_file, after_this_request, jsonify
from botocore.config import Config
import imageio
import tempfile
import time
import datetime


s3 = boto3.client(
    "s3",
    config=Config(signature_version="s3"),
    aws_access_key_id=env.get("AWS_ACCESS"),
    aws_secret_access_key=env.get("AWS_SECRET"),
    region_name='us-east-1'
)

# Remove the S3 client initialization code

@app.route("/create-video", methods=["POST"])
def create_video():
    try:
        app.logger.info("\ncreating video")
        data_json = request.get_json()
        frame_data = data_json["frame_data"]
# get the first key in the frame_data dictionary
        first_key = list(frame_data.keys())[0]
        # get the first frame
        first_frame = frame_data[first_key]["frame"]
        processed_frame = encode_frame(first_frame)

        height, width, layers = processed_frame.shape
        size = (width, height)

        # print(f'size = {size}')

        # temp_vid = tempfile.NamedTemporaryFile(suffix=".mp4", delete=False)

        # out = cv2.VideoWriter(temp_vid.name, cv2.VideoWriter_fourcc(*"mp4v"), 24, size)

        # for key, value in frame_data.items():
        #     frame = encode_frame(value["frame"])
        #     out.write(frame)
        # out.release()

        # prepare a list to store the frames
        frames = []
        for key, value in frame_data.items():
            frame = encode_frame(value["frame"])
            frames.append(frame)
            # print(frames)

        # Create webm file in memory using imageio
        # video_bytes = create_video_file(frames)
        # this saves the video in a bytesio memory object, but it has to be saved to a file to be uploaded to s3

        # create webm file
        temp_vid = tempfile.NamedTemporaryFile(suffix=".webm", delete=False)
        imageio.mimwrite(temp_vid.name, frames, fps=24, codec='vp8')
        
        # Prepare the file name and upload it to S3
        filename = f"{current_user.username}/{os.path.basename(temp_vid.name)}"
        s3.upload_file(temp_vid.name, "medship", filename)

        # Generate a presigned URL for the uploaded file
        presigned_url = s3.generate_presigned_url(
            "get_object",
            Params={"Bucket": "medship", "Key": filename},
            ExpiresIn=3600,
        )

        @after_this_request
        def delete_file(response):
            remove_video(temp_vid.name)
            return response

        # Modify the frame_data to remove the 'frame' item from each element
        for key, value in frame_data.items():
            if "frame" in value:
                del value["frame"]
                
        emotion_percents = get_dominant_emotion(frame_data)

        # Return the filename and modified frame_data in the response
        return (
            jsonify(
                {
                    # 'filename': filename,
                    "filename": presigned_url,
                    # "frame_data": frame_data,
                    "frame_data": emotion_percents,
                }
            ),
            200,
        )


    except Exception as e:
        app.logger.error(
            e
        )  # its better to use app.logger as print is not shown in the logs
        return "", 500


def encode_frame(base64_frame):
    data = base64_frame.split(",")[1]
    data = base64.b64decode(data)
    img = Image.open(BytesIO(data))
    frame = np.array(img)
    return frame


def remove_video(filename):
    try:
        os.remove(filename)
        print("video deleted!")
    except Exception as error:
        app.logger.error("Error removing video", error)


def create_video_file(frames):
    # Create video file in memory using imageio
    video_bytes = BytesIO()
    imageio.mimwrite(video_bytes, frames, format="webm", fps=24, codec="vp8")
    video_bytes.seek(0)
    return video_bytes.read()


def get_unique_filename():
    timestamp = datetime.datetime.now().strftime("%Y%m%d%H%M%S%f")
    return f"video_{timestamp}"


def get_dominant_emotion(data_dict):
    emotion_count = {
        "anger": 0,
        "contempt": 0,
        "disgust": 0,
        "engagement": 0,
        "fear": 0,
        "joy": 0,
        "sadness": 0,
        "surprise": 0,
    }

    for key in data_dict:
        emotions = data_dict[key]['results']
    # .get('emotions', {})
        print(f'emotions = {emotions}')
        # Remove valence from the emotions dictionary
        if "valence" in emotions:
            del emotions["valence"]

        if "compassion" in emotions:
            del emotions["compassion"]

        if "listening" in emotions:
            del emotions["listening"]

        if "welcoming" in emotions:
            del emotions["welcoming"]

        if emotions:
            dominant_emotion = max(emotions, key=emotions.get)
            print(f'dominant_emotion = {dominant_emotion}')

            # Increase the count for this emotion
            if dominant_emotion in emotion_count:
                emotion_count[dominant_emotion] += 1
            else:
                emotion_count[dominant_emotion] = 1
    print(f'emotion_count = {emotion_count}')
    
    # Get the total number of samples
    total_samples = sum(emotion_count.values())
    #now make a list with just the emotion counts
    emotion_list = list(emotion_count.values())
    #now make a list with the percentages
    emotion_percentages = [int((emotion / total_samples) * 10) for emotion in emotion_list]

    print(f'emotion_percentages = {emotion_percentages}')
    return emotion_percentages

if DEBUG:
    app.logger.info("DEBUG       = " + str(DEBUG))
    app.logger.info("Environment = " + get_config_mode)
    app.logger.info("DBMS        = " + app_config.SQLALCHEMY_DATABASE_URI)

if __name__ == "__main__":
    app.run()
