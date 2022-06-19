import { useEffect, useState } from "react";
import { useMediaQuery } from 'react-responsive';
import { useSearchParams } from "react-router-dom";
import Select from 'react-select';
import { countryCodes } from "../constants/countryCodes";
import { Rating, Video, YouTube } from "../lib/youtube";


enum SearchParam {
    Countries = "countries",
}


const clientId = '369453766252-jktags0v36ha027d1is83tjagm690t48.apps.googleusercontent.com';

enum StorageItem {
    videos = 'videos',
    ratingMap = 'ratingMap',
    newlyRatedVideoIds = 'newlyRatedVideoIds',
}

interface Option {
    value: string;
    label: string;
}

const countryCodeOptions = countryCodes.map(({ code, country }) => ({
    value: code,
    label: country,
}))

const countryCodeCountryMap = new Map(countryCodeOptions.map(({ value, label }) => [value, label]));
type RatingMap = Record<Video['id'], Rating>;
export function Search() {
    const [tokenClient, setTokenClient] = useState<google.accounts.oauth2.TokenClient | null>(null);
    const [accessToken, setAccessToken] = useState<string | null>(null);
    const [videos, setVideos] = useState<Array<Video>>([]);
    const [ratingMap, setRatingMap] = useState<RatingMap>({});
    const [newlyRatedVideoIds, setNewlyRatedVideoIds] = useState<Set<Video['id']>>(new Set());

    useEffect(() => {
        const storageVideos = localStorage.getItem(StorageItem.videos);
        if (storageVideos) {
            setVideos(JSON.parse(storageVideos));
        }

        const storageRatingMap = localStorage.getItem(StorageItem.ratingMap);
        if (storageRatingMap) {
            setRatingMap(JSON.parse(storageRatingMap));
        }

        const storageNewlyRatedVideoIds = localStorage.getItem(StorageItem.newlyRatedVideoIds);
        if (storageNewlyRatedVideoIds) {
            setNewlyRatedVideoIds(new Set(JSON.parse(storageNewlyRatedVideoIds)));
        }
    }, []);

    const [selectedCountryCodes, setSelectedCountryCodes] = useState<readonly Option[]>([]);
    const initTokenClient = () => {
        const client = google.accounts.oauth2.initTokenClient({
            client_id: clientId,
            scope: 'https://www.googleapis.com/auth/youtubepartner',
            callback: (tokenResponse) => {
                setAccessToken(tokenResponse.access_token);
                console.log(`Obtained access token: ${tokenResponse.access_token}`)
            },
        });
        setTokenClient(client);
    }

    useEffect(() => {
        window.addEventListener('load', initTokenClient);

        return () => {
            window.removeEventListener('load', initTokenClient);
        }
    }, []);

    const [searchParams, setSearchParams] = useSearchParams();

    useEffect(() => {
        const countriesParam = searchParams.get(SearchParam.Countries);
        if (countriesParam === null) {
            return;
        }

        const countryCodes = countriesParam.split(',');
        const countryOptions = new Map<string, string>();

        for (const code of countryCodes) {
            const country = countryCodeCountryMap.get(code);
            if (country) {
                countryOptions.set(code, country);
            }
        }

        const options = Array.from(countryOptions.entries()).sort((a, b) => a[1].localeCompare(b[1]))
            .map(([value, label]) => ({ value, label }));

        setSelectedCountryCodes(options);
        window.scrollTo({ top: 0 });
    }, [searchParams]);


    const isWideScreen = useMediaQuery({
        query: '(min-width: 520px)'
    })


    const search = async () => {
        if (!accessToken) {
            return window.alert('Please sign it first so that we can hide the videos that you have already rated.')
        }

        if (selectedCountryCodes.length === 0) {
            return window.alert('Please select at least one country.')
        }

        const youtube = new YouTube({
            apiKey: clientId,
            token: accessToken,
        });

        console.log('Loading most popular videos...');
        const allVideos = await Promise.all(selectedCountryCodes.map(({ value }) => youtube.listMostPopularVideos(value)))
        console.log(allVideos);
        let allVideoIds = new Set<string>();

        let totalVideoCount = 0;
        for (const { items } of allVideos) {
            for (const item of items) {
                totalVideoCount += 1;
                allVideoIds.add(item.id);
            }
        }

        console.log(`Getting rating for ${allVideoIds.size} unique videos out of ${totalVideoCount} in total.`)

        let chunks: Array<Array<string>> = [[]];

        let limit = 30;
        let i = 0
        for (const videoId of allVideoIds.values()) {
            i += 1;
            if (i % limit === 1) {
                chunks.push([videoId]);
            } else {
                chunks[chunks.length - 1].push(videoId);
            }
        }
        const ratings = await Promise.all(chunks.filter((items) => items.length > -0).map((chunk) => youtube.getRating(chunk)));
        console.log(ratings)

        const seenVideos = new Set<string>()
        const uniqueVideos: Array<Video> = [];


        for (const res of allVideos) {
            for (const item of res.items) {
                if (seenVideos.has(item.id)) {
                    continue;
                }
                seenVideos.add(item.id);
                uniqueVideos.push(item)
            }
        }

        uniqueVideos.sort((a, b) => b.viewCount - a.viewCount)
        setVideos(uniqueVideos);
        localStorage.setItem(StorageItem.videos, JSON.stringify(uniqueVideos));
        const newRatingMap = ratings.flatMap((value) => value.items).reduce((acc, item) => {
            acc[item.videoId] = item.rating;
            return acc;
        }, {} as RatingMap);
        setRatingMap(newRatingMap);
        localStorage.setItem(StorageItem.ratingMap, JSON.stringify(newRatingMap));

    }

    const displayedVideos = videos.filter((video) => {
        if (newlyRatedVideoIds.has(video.id)) {
            return false;
        }

        const rating = ratingMap[video.id];
        return rating !== 'like' && rating !== 'dislike'
    })

    return (
        <div
            style={{
                display: "flex",
                justifyContent: "center",
            }}
        >
            <div
                style={{
                    marginLeft: "var(--line-height-2xs)",
                    marginRight: "var(--line-height-2xs)",
                    width: "800px",
                }}
            >
                <div>
                    {
                        accessToken
                            ? null
                            : (
                                <div>
                                    <button
                                        style={{
                                            marginBottom: '1em'
                                        }}
                                        id="getToken"
                                        onClick={() =>
                                            tokenClient?.requestAccessToken({})
                                        }>Sign in with Google</button>
                                </div>
                            )
                    }
                    <Select
                        isMulti
                        name="regions"
                        options={countryCodeOptions}
                        value={selectedCountryCodes}
                        onChange={(newValue) => {
                            const newOptions = Array.from(newValue).sort((a, b) => a.label.localeCompare(b.label));
                            setSelectedCountryCodes(newOptions);
                            setSearchParams({
                                ...searchParams,
                                countries: newValue.map(({ value }) => value).join(),
                            });

                            console.log(newOptions);
                        }}
                        className="basic-multi-select"
                        classNamePrefix="select"
                    />

                    <button
                        style={{
                            marginBottom: "1em",
                            marginTop: "1em",
                        }}
                        onClick={() => search()}
                    >
                        Search
                    </button>
                </div>
                <div
                    style={{
                        marginBottom: "2em",
                        marginTop: "2em",
                    }}
                >
                    <a href={`http://www.youtube.com/watch_videos?video_ids=${displayedVideos.slice(0, 50).map((video) => video.id).join(',')}`}>
                        Make YouTube playlist from the first 50 songs.
                        </a>
                </div>
                <section>
                    {
                        displayedVideos.map((video) => (
                            <div
                                key={video.id}
                                style={{
                                    marginBottom: '1em'
                                }}
                            >
                                <div>
                                    <button onClick={() => {
                                        const newSet = new Set(newlyRatedVideoIds);
                                        newSet.add(video.id);
                                        setNewlyRatedVideoIds(newSet);
                                        const list = JSON.stringify(Array.from(newSet.values()));
                                        localStorage.setItem(StorageItem.newlyRatedVideoIds, list);
                                    }}>Rated</button>
                                    <a href={`https://www.youtube.com/watch?v=${video.id}`} target="_blank">{video.title}</a>
                                </div>
                            </div>
                        ))
                    }
                </section>
            </div>
        </div>
    )
}
