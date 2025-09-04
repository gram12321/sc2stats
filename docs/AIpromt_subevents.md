We have succesfully create a @scraper.py  that scrapes data from liquidpedia tournament pages, a database_parser.py and a @database_inserter.py  that put this data into supabase. We have succesfully scraped @https://liquipedia.net/starcraft2/UThermal_2v2_Circuit/Main_Event 

Liquidpedia is build in a way that a tournament page like this, can have multiple sub events. We have succesfully create a scraper that can automaticlkly detect and scrape all event including subevents 

We are ready to move on to next phase in the development, which is to create a webinterface for displaying the results/analyses. As descriped in the @readme.md we will use react/vite, typescript, ShadCN. 

task is:
1. Make sure we have all dependencies needed
2. Create the initial layout for the webinterface.
3. Succesfully run a developer view (npm run dev.)