#!/usr/bin/env python3
"""Debug script to check subevent discovery."""

from scraper import SC2Scraper

def main():
    scraper = SC2Scraper()
    tournament_series = 'UThermal_2v2_Circuit'
    
    print('🔍 Finding subevents...')
    subevents = scraper.find_subevents(tournament_series)
    print(f'Found {len(subevents)} subevents:')
    for i, subevent in enumerate(subevents):
        print(f'  {i+1}. "{subevent}"')

    print()
    print('Hardcoded main event: UThermal_2v2_Circuit/Main_Event')
    print('Target tournaments would be:')
    target_tournaments = []
    
    # Add hardcoded main event
    main_event_slug = f'{tournament_series}/Main_Event'
    target_tournaments.append(main_event_slug)
    print(f'  - {main_event_slug}')

    # Add discovered subevents
    for subevent in subevents:
        subevent_slug = f'{tournament_series}/{subevent}'
        target_tournaments.append(subevent_slug)
        print(f'  - {subevent_slug}')

    print()
    print('Checking for duplicates...')
    if 'Main Event' in subevents:
        print('❌ DUPLICATE FOUND: "Main Event" is in discovered subevents!')
        print('This will create: UThermal_2v2_Circuit/Main Event (space)')
        print('Plus hardcoded: UThermal_2v2_Circuit/Main_Event (underscore)')
    else:
        print('✅ No duplicate - "Main Event" not in subevents')

if __name__ == "__main__":
    main()
