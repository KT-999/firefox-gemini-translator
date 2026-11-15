import os
import sys
import time
import json
import uuid
import hmac
import hashlib
import base64
import zipfile
import subprocess

def base64url_encode(data):
    if isinstance(data, str):
        data = data.encode('utf-8')
    return base64.urlsafe_b64encode(data).rstrip(b'=').decode('utf-8')

def generate_jwt(issuer, secret):
    header = {"alg": "HS256", "typ": "JWT"}
    payload = {
        "iss": issuer,
        "jti": str(uuid.uuid4()),
        "iat": int(time.time()),
        "exp": int(time.time()) + 300
    }
    
    b64_header = base64url_encode(json.dumps(header))
    b64_payload = base64url_encode(json.dumps(payload))
    
    msg = f"{b64_header}.{b64_payload}"
    sig = hmac.new(secret.encode('utf-8'), msg.encode('utf-8'), hashlib.sha256).digest()
    
    return f"{msg}.{base64url_encode(sig)}"

def create_zip(source_dir, zip_name):
    print(f"Creating {zip_name} from {source_dir}...")
    exclude_dirs = {'.git', 'node_modules', '.vscode', '__pycache__'}
    exclude_files = {'desktop.ini', '.DS_Store'}
    
    with zipfile.ZipFile(zip_name, 'w', zipfile.ZIP_DEFLATED) as zf:
        for root, dirs, files in os.walk(source_dir):
            dirs[:] = [d for d in dirs if d not in exclude_dirs]
            for file in files:
                if file in exclude_files or file.startswith('.'):
                    continue
                file_path = os.path.join(root, file)
                arcname = os.path.relpath(file_path, source_dir).replace(os.sep, '/')
                zf.write(file_path, arcname)
    print("Zip created successfully.")

def upload_to_amo(jwt_token, zip_name, addon_id, license_slug="MIT", release_notes=None):
    print(f"Uploading file {zip_name} to AMO for addon {addon_id}...")
    upload_url = "https://addons.mozilla.org/api/v5/addons/upload/"
    
    # 1. Upload the file
    upload_cmd = [
        "curl.exe", "-s", upload_url,
        "-g", "-X", "POST",
        "-F", f"upload=@{zip_name}",
        "-F", "channel=listed",
        "-H", f"Authorization: JWT {jwt_token}"
    ]
    
    result = subprocess.run(upload_cmd, capture_output=True, text=True)
    if result.returncode != 0:
        print(f"Upload command failed: {result.stderr}")
        return False
        
    try:
        upload_data = json.loads(result.stdout)
    except Exception as e:
        print(f"Failed to parse upload response: {result.stdout}")
        return False
        
    if 'uuid' not in upload_data:
        print(f"Upload failed. Response: {upload_data}")
        return False
        
    upload_uuid = upload_data['uuid']
    print(f"Upload successful. UUID: {upload_uuid}")
    
    # 2. Wait for validation
    print("Waiting for AMO validation...")
    status_url = f"https://addons.mozilla.org/api/v5/addons/upload/{upload_uuid}/"
    while True:
        status_cmd = [
            "curl.exe", "-s", status_url,
            "-H", f"Authorization: JWT {jwt_token}"
        ]
        res = subprocess.run(status_cmd, capture_output=True, text=True)
        try:
            status_data = json.loads(res.stdout)
            if status_data.get('processed'):
                if status_data.get('valid'):
                    print("Validation passed!")
                    break
                else:
                    print("Validation failed!")
                    print(json.dumps(status_data.get('validation', {}), indent=2))
                    return False
            else:
                print("Still processing... waiting 3 seconds")
                time.sleep(3)
        except Exception as e:
            print(f"Error checking status: {res.stdout}")
            return False

    # 3. Create the version
    print("Creating new version on AMO...")
    version_url = f"https://addons.mozilla.org/api/v5/addons/addon/{addon_id}/versions/"
    
    payload = {
        "upload": upload_uuid,
        "license": license_slug
    }
    if release_notes:
        payload["release_notes"] = release_notes
        
    version_data = json.dumps(payload)
    
    version_cmd = [
        "curl.exe", "-s", version_url,
        "-g", "-X", "POST",
        "-d", version_data,
        "-H", "Content-Type: application/json",
        "-H", f"Authorization: JWT {jwt_token}"
    ]
    
    result2 = subprocess.run(version_cmd, capture_output=True, text=True)
    try:
        version_resp = json.loads(result2.stdout)
        if 'id' in version_resp:
            print("Version created successfully on AMO!")
            print(f"Version ID: {version_resp['id']}")
            print(f"Version string: {version_resp.get('version')}")
            return True
        else:
            print(f"Failed to create version. Response: {version_resp}")
            return False
    except:
        print(f"Failed to parse version response: {result2.stdout}")
        return False

if __name__ == "__main__":
    jwt_user = os.environ.get("JWT_USER")
    jwt_key = os.environ.get("JWT_KEY")
    
    if not jwt_user or not jwt_key:
        print("Error: JWT_USER or JWT_KEY environment variables are not set.")
        sys.exit(1)
        
    script_dir = os.path.dirname(os.path.abspath(__file__))
    source_dir = os.path.join(script_dir, "firefox-gemini-translator")
    manifest_file = os.path.join(source_dir, "manifest.json")
    
    with open(manifest_file, "r", encoding="utf-8") as mf:
        mdata = json.load(mf)
        
    addon_version = mdata.get("version", "2.6.0")
    addon_id = mdata.get("browser_specific_settings", {}).get("gecko", {}).get("id", "gemini-translator@kenny.com")
    
    zip_name = os.path.join(script_dir, f"firefox-gemini-translator-v{addon_version}.zip")
    
    token = generate_jwt(jwt_user, jwt_key)
    create_zip(source_dir, zip_name)
    
    release_notes = {
        "zh-TW": "升級至 v2.6.0: 支援 Gemini 4 系列 (Carbon, Argon, Hydrogen)、Gemini 3.8 Pro 最新 API，並優化多語系支援與相容性。",
        "en-US": "Upgrade to v2.6.0: Support latest Gemini 4 series (Carbon, Argon, Hydrogen) and Gemini 3.8 Pro, with improved i18n and compatibility."
    }
    
    success = upload_to_amo(token, zip_name, addon_id, license_slug="MIT", release_notes=release_notes)
    if success:
        print(f"Successfully published {addon_id} v{addon_version} to Firefox Add-ons!")
    else:
        print("Publishing to Firefox Add-ons failed.")
        sys.exit(1)
