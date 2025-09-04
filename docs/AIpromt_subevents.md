We have succesfully create a @scraper.py  that scrapes data from liquidpedia tournament pages, and a @database_inserter.py  that put this data into supabase. We have succesfully scraped @https://liquipedia.net/starcraft2/UThermal_2v2_Circuit/Main_Event 

Now the liquidpedia is build in a way that a tournament page like this, can have multiple sub events. In this case we have a mainevent (the one we have succesfully scraped) but also hold multiple subevents (like @https://liquipedia.net/starcraft2/UThermal_2v2_Circuit/1 ) 

From the main event we will find links to all subevents. (in this case, january, february, last chance, warmup cup #1, #2 ect.) 

Ideally we want the scraper to be able to identify these sub event by it self. and scrape them too. 

For now We have succesfully tested and created a scraper that can handle both mainevent and subevents. And we have tested that we are able to automaticly detect subevents, by testing both main and january event at the same time. Next we want to test without limiting subevents, this has now passed the test aswell. Though we created some bugs. We have squashed the bugs that gave us false results for the january tournament. And we now get correct results for both main event and january events when running the automatic get all subevents for multiple tournaments. We want to test the rest of the event to make sure we get the right amount of matches and correct results


task is:
1. Clear database (use MCP) 
2. Run scraper again and list match numbers for each event (hopefully we get 12 subevents including the mainevents)