We have succesfully create a @scraper.py  that scrapes data from liquidpedia tournament pages, and a @database_inserter.py  that put this data into supabase. We have succesfully scraped @https://liquipedia.net/starcraft2/UThermal_2v2_Circuit/Main_Event 

Now the liquidpedia is build in a way that a tournament page like this, can have multiple sub events. In this case we have a mainevent (the one we have succesfully scraped) but also hold multiple subevents (like @https://liquipedia.net/starcraft2/UThermal_2v2_Circuit/1 ) 

From the main event we will find links to all subevents. (in this case, january, february, last chance, warmup cup #1, #2 ect.) 

Ideally we want the scraper to be able to identify these sub event by it self. and scrape them too. 

For now We have succesfully tested and created a scraper that can handle both mainevent and subevents. Next we would like to be able to scrape both mainevent and subevents. And idealy we want the scrape to automaticly detect subevents.


task is:
1. Clear database (use MCP) Verify that we can infact scrape both main event and subevent. And get both of them into the database at the same time
2. Create a solution that automatickly identify subevents and scrape both main and subevents. (IE the test event Utermal2v2circut hold a lot of subevent for testing purpose we should limit ourself to just the mainevent and the january event)