#!/usr/bin/env python3
"""
Process activities and their stream data from intervals.icu API data.
Combines activity metadata (datetime, duration, distance) with stream data
(heartrate, velocity_smooth) into a single JSON file for webapp consumption.
"""

import json
import os
from pathlib import Path
from typing import List, Dict, Any


def load_activities(data_dir: Path) -> List[Dict[str, Any]]:
    """Load activities from activities.json file."""
    activities_file = data_dir / "activities.json"

    if not activities_file.exists():
        raise FileNotFoundError(f"Activities file not found: {activities_file}")

    with open(activities_file, 'r') as f:
        activities = json.load(f)

    return activities


def load_stream_data(activity_id: str, data_dir: Path) -> Dict[str, Any]:
    """Load stream data for a specific activity."""
    stream_file = data_dir / "streams" / f"{activity_id}.json"

    if not stream_file.exists():
        print(f"Warning: Stream file not found for activity {activity_id}: {stream_file}")
        return {}

    try:
        with open(stream_file, 'r') as f:
            stream_data = json.load(f)
        return stream_data
    except json.JSONDecodeError as e:
        print(f"Warning: Failed to parse stream file for activity {activity_id}: {e}")
        return {}


def process_activities(data_dir: Path, output_file: Path) -> None:
    """
    Process all activities and their stream data.

    Args:
        data_dir: Directory containing activities.json and streams/ subdirectory
        output_file: Path to output JSON file
    """
    print("Loading activities...")
    activities = load_activities(data_dir)
    print(f"Found {len(activities)} activities")

    processed_activities = []

    for activity in activities:
        # Filter for runs only (type == 'Run')
        if activity.get('type') != 'Run':
            continue

        activity_id = activity.get('id')
        if not activity_id:
            print(f"Warning: Activity missing ID, skipping: {activity}")
            continue

        # Extract basic activity metadata
        processed_activity = {
            'id': activity_id,
            'datetime': activity.get('start_date_local'),
            'duration': activity.get('moving_time') or activity.get('elapsed_time'),
            'distance': activity.get('distance'),
        }

        # Load and attach stream data
        stream_data = load_stream_data(str(activity_id), data_dir)

        if stream_data:
            # Stream data is a list of stream objects with 'type' and 'data' fields
            heartrate = []
            velocity_smooth = []

            if isinstance(stream_data, list):
                for stream in stream_data:
                    if isinstance(stream, dict):
                        stream_type = stream.get('type')
                        if stream_type == 'heartrate':
                            heartrate = stream.get('data', [])
                        elif stream_type == 'velocity_smooth':
                            velocity_smooth = stream.get('data', [])
            elif isinstance(stream_data, dict):
                # Handle dict format (in case structure varies)
                heartrate = stream_data.get('heartrate', [])
                velocity_smooth = stream_data.get('velocity_smooth', [])

            processed_activity['heartrate'] = heartrate
            processed_activity['velocity_smooth'] = velocity_smooth
        else:
            processed_activity['heartrate'] = []
            processed_activity['velocity_smooth'] = []

        processed_activities.append(processed_activity)

    print(f"Processed {len(processed_activities)} run activities")

    # Write combined data to output file
    print(f"Writing output to {output_file}...")
    with open(output_file, 'w') as f:
        json.dump(processed_activities, f, indent=2)

    print("Done!")


def main():
    """Main entry point."""
    # Set up paths
    script_dir = Path(__file__).parent
    data_dir = script_dir / "data"
    output_file = data_dir / "processed_activities.json"

    # Process activities
    process_activities(data_dir, output_file)

    # Print summary
    print(f"\nOutput file: {output_file}")
    print(f"File size: {output_file.stat().st_size / 1024:.2f} KB")


if __name__ == "__main__":
    main()
