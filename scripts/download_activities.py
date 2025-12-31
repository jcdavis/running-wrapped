#!/usr/bin/env python3
"""
Download intervals.icu activities and data streams for 2025.

Usage:
    python download_activities.py <API_TOKEN>
"""

import sys
import json
import os
import base64
from datetime import datetime
from pathlib import Path
import urllib.request
import urllib.error
from typing import Dict, List, Any


def make_api_request(url: str, api_token: str) -> Any:
    """Make a request to the intervals.icu API."""
    # Base64 encode the credentials for Basic authentication
    credentials = f'API_KEY:{api_token}'
    encoded_credentials = base64.b64encode(credentials.encode('utf-8')).decode('utf-8')

    request = urllib.request.Request(url)
    request.add_header('Authorization', f'Basic {encoded_credentials}')
    request.add_header('Accept', 'application/json')

    try:
        with urllib.request.urlopen(request) as response:
            return json.loads(response.read().decode('utf-8'))
    except urllib.error.HTTPError as e:
        print(f"HTTP Error {e.code}: {e.reason}")
        print(f"URL: {url}")
        if e.code == 401:
            print("Authentication failed. Please check your API token.")
        sys.exit(1)
    except urllib.error.URLError as e:
        print(f"URL Error: {e.reason}")
        sys.exit(1)


def get_activities(athlete_id: str, api_token: str, year: int = 2025) -> List[Dict]:
    """Get all activities for the specified year."""
    # intervals.icu uses ISO date format (YYYY-MM-DD)
    start_date = f"{year}-01-01"
    end_date = f"{year}-12-31"

    url = f"https://intervals.icu/api/v1/athlete/{athlete_id}/activities?oldest={start_date}&newest={end_date}"
    print(f"Fetching activities from {start_date} to {end_date}...")

    activities = make_api_request(url, api_token)

    # Filter to only include runs (type should be present)
    activities = [a for a in activities if a.get('type') == 'Run']

    print(f"Found {len(activities)} activities")
    return activities


def get_activity_streams(athlete_id: str, activity_id: str, api_token: str) -> Dict:
    """Get data streams for a specific activity."""
    url = f"https://intervals.icu/api/v1/activity/{activity_id}/streams"

    try:
        streams = make_api_request(url, api_token)
        return streams
    except Exception as e:
        print(f"Warning: Could not fetch streams for activity {activity_id}: {e}")
        return {}


def save_json(data: Any, filepath: Path) -> None:
    """Save data as JSON to a file."""
    filepath.parent.mkdir(parents=True, exist_ok=True)
    with open(filepath, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=2, ensure_ascii=False)


def main():
    if len(sys.argv) != 2:
        print("Usage: python download_activities.py <API_TOKEN>")
        print("\nTo get your API token:")
        print("1. Log in to intervals.icu")
        print("2. Go to settings (gear icon)")
        print("3. Navigate to the 'Developer' tab")
        print("4. Copy your API key")
        sys.exit(1)

    api_token = sys.argv[1]
    data_dir = Path("../data")

    print("intervals.icu Activity Downloader")
    print("=" * 50)

    # Get athlete ID
    print("\nFetching athlete information...")
    athlete_id = 0
    print(f"Athlete ID: {athlete_id}")

    # Get all activities for 2025
    activities = get_activities(athlete_id, api_token, year=2025)

    # Save activities list
    activities_file = data_dir / "activities.json"
    save_json(activities, activities_file)
    print(f"\nSaved activities list to {activities_file}")

    # Create streams directory
    streams_dir = data_dir / "streams"
    streams_dir.mkdir(parents=True, exist_ok=True)

    # Download streams for each activity
    print(f"\nDownloading streams for {len(activities)} activities...")
    for i, activity in enumerate(activities, 1):
        activity_id = activity.get('id')
        activity_name = activity.get('name', 'Unnamed')
        activity_date = activity.get('start_date_local', 'unknown')

        print(f"[{i}/{len(activities)}] {activity_date} - {activity_name} (ID: {activity_id})")

        streams = get_activity_streams(athlete_id, activity_id, api_token)

        if streams:
            # Save streams with activity ID as filename
            stream_file = streams_dir / f"{activity_id}.json"
            save_json(streams, stream_file)
        else:
            print(f"  No streams available for this activity")

    print("\n" + "=" * 50)
    print("Download complete!")
    print(f"Activities saved to: {activities_file}")
    print(f"Streams saved to: {streams_dir}/")
    print(f"Total activities: {len(activities)}")


if __name__ == "__main__":
    main()
