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

# Connecting to file storage with AWS S3
resource = boto3.resource(
    "s3",
    aws_access_key_id=str(os.getenv("AWS_ACCESS")),
    aws_secret_access_key=str(os.getenv("AWS_SECRET")),
    region_name="us-east-1",
)


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
        return {"success": False, "error": str(e)}


# ====================================================================================================
"""training video generation stuff"""
# ====================================================================================================

import base64

# import cv2
# import numpy as np
from PIL import Image
from io import BytesIO
from flask import send_file, after_this_request, jsonify
import tempfile
from botocore.config import Config
import imageio

s3 = boto3.client(
    "s3",
    config=Config(signature_version="s3v4"),
    aws_access_key_id=env.get("AWS_ACCESS"),
    aws_secret_access_key=env.get("AWS_SECRET"),
    region_name='us-east-2'
)


@app.route("/create-video", methods=["POST"])
def create_video():
    try:
        data_json = request.get_json()
        frame_data = data_json["frame_data"]

        # Prepare a list to store all frames
        frames = []

        detected_timestamps = []

        for key, value in frame_data.items():
            frame = encode_frame(value["frame"])
            frames.append(frame)

            timestamp = int(round(float(key)))

            if (
                value.get("results", {}).get("compassion") == "Detected" or
                value.get("results", {}).get("listening") == "Detected" or
                value.get("results", {}).get("welcoming") == "Detected"
            ):
                detected_timestamps.append({"timestamp": timestamp, "detected": "Detected"})

        # Create webm file
        temp_vid = tempfile.NamedTemporaryFile(suffix=".webm", delete=False)
        imageio.mimwrite(temp_vid.name, frames, fps=24, codec="vp8")

        # Prepare the file name and upload it to S3
        filename = f"{current_user.username}/{os.path.basename(temp_vid.name)}"
        s3.upload_file(temp_vid.name, "mdship-test", filename)

        # Generate a presigned URL for the uploaded file
        presigned_url = s3.generate_presigned_url(
            "get_object",
            Params={"Bucket": "mdship-test", "Key": filename},
            ExpiresIn=3600,
        )

        @after_this_request
        def delete_file(response):
            remove_video(temp_vid.name)
            return response

        # Return the filename and detected_timestamps in the response
        return (
            jsonify(
                {
                    "filename": presigned_url,
                    "detected_timestamps": detected_timestamps,
                }
            ),
            200,
        )

    except Exception as e:
        print(e)
        return "", 500


def remove_video(filename):
    try:
        os.remove(filename)
        print("Video deleted!")
    except Exception as error:
        app.logger.error("Error removing video", error)


def encode_frame(base64_frame):
    data = base64_frame.split(",")[1]  # Remove the "data:image/png;base64," part
    data = base64.b64decode(data)

    # Convert the data to an image
    img = Image.open(BytesIO(data))

    # Convert the image to a numpy array
    frame = np.array(img)

    return frame


if DEBUG:
    app.logger.info("DEBUG       = " + str(DEBUG))
    app.logger.info("Environment = " + get_config_mode)
    app.logger.info("DBMS        = " + app_config.SQLALCHEMY_DATABASE_URI)

if __name__ == "__main__":
    app.run()