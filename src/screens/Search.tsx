import { useEffect, useRef, useState } from "react";
import { useMediaQuery } from 'react-responsive';
import { useSearchParams } from "react-router-dom";
import Select from 'react-select';
import { countryCodes } from "../constants/countryCodes";
import { Rating, Video, YouTube } from "../lib/youtube";

function GoogleIcon() {
    return (
        <svg
            version="1.1"
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 48 48"
            className="LgbsSe-Bz112c">
            <g>
                <path
                    fill="#EA4335"
                    d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z">
                        </path><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"></path><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"></path><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"></path><path fill="none" d="M0 0h48v48H0z"></path></g></svg>
    )
}

function GoogleSignInButton(props: JSX.IntrinsicElements['button']) {
    return (
        <button
            style={{
                display: "flex",
                height: "20px",
                width: "100px"
            }}
            {...props}
        >
            <GoogleIcon />
            <p>Sign in with Google</p>
        </button>
    )
}

enum SearchParam {
    Countries = "countries",
}


const clientId = '369453766252-jktags0v36ha027d1is83tjagm690t48.apps.googleusercontent.com';

enum StorageItem {
    videos = 'videos',
    ratingMap = 'ratingMap',
    ratedPlaylistChunkIds = 'ratedPlaylistChunkIds',
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

interface PlaylistData { chunkId: number, videoIds: Array<string> }
export function Search() {
    const [tokenClient, setTokenClient] = useState<google.accounts.oauth2.TokenClient | null>(null);
    const [accessToken, setAccessToken] = useState<string | null>(null);
    const [videos, setVideos] = useState<Array<Video>>([]);
    const [ratingMap, setRatingMap] = useState<RatingMap>({});
    const [ratedPlaylistChunkIds, setRatedPlaylistChunkIds] = useState<Set<PlaylistData['chunkId']>>(new Set());
    const [selectedCountryCodes, setSelectedCountryCodes] = useState<readonly Option[]>([]);
    const [shouldDiscoverAllCountries, setShouldDiscoverAllCountries] = useState<boolean>(true);

    const countryCodesToUse = shouldDiscoverAllCountries ? countryCodeOptions : selectedCountryCodes;
    // const signInButton = useRef(null);
    // const [g, setG] = useState<null | typeof google>(null);

    // useEffect(() => {
    //     window.onload = function () {
    //         google.accounts.id.initialize({
    //             client_id: clientId,
    //         });
    //         setG(google);
    //     }
    // }, [])

    // useEffect(() => {
    //     if (g && signInButton.current) {
    //         google.accounts.id.renderButton(
    //             signInButton.current,
    //             { theme: "outline", size: "large", type: "standard" }
    //         );
    //     }
    // }, [g, signInButton])

    useEffect(() => {
        const storageVideos = localStorage.getItem(StorageItem.videos);
        if (storageVideos) {
            setVideos(JSON.parse(storageVideos));
        }

        const storageRatingMap = localStorage.getItem(StorageItem.ratingMap);
        if (storageRatingMap) {
            setRatingMap(JSON.parse(storageRatingMap));
        }

        const storageNewlyRatedVideoIds = localStorage.getItem(StorageItem.ratedPlaylistChunkIds);
        if (storageNewlyRatedVideoIds) {
            setRatedPlaylistChunkIds(new Set(JSON.parse(storageNewlyRatedVideoIds)));
        }
    }, []);

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

        if (countryCodesToUse.length === 0) {
            return window.alert('Please select at least one country.')
        }

        const youtube = new YouTube({
            apiKey: clientId,
            token: accessToken,
        });

        console.log('Loading most popular videos...');
        const allVideos = await Promise.all(countryCodesToUse.map(({ value }) => youtube.listMostPopularVideos(value)))
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
        localStorage.setItem(StorageItem.ratedPlaylistChunkIds, '[]');

    }

    const unratedVideos = videos.filter((video) => {
        const rating = ratingMap[video.id];
        return rating !== 'like' && rating !== 'dislike'
    })



    const unratedVideoChunks: Array<PlaylistData> = [];

    let i = 0;
    let chunkId = 0;
    let limit = 50;
    let chunkVideoIds: PlaylistData['videoIds'] = [];
    for (const video of unratedVideos) {
        if (i % limit === 0) {
            chunkId += 1;
            unratedVideoChunks.push({ chunkId, videoIds: chunkVideoIds });
            chunkVideoIds = [video.id];
        } else {
            chunkVideoIds.push(video.id);
        }
        i += 1;
    }

    const displayedUnratedVideoChunks = unratedVideoChunks.filter((chunk) => !ratedPlaylistChunkIds.has(chunk.chunkId));
    const allRated = displayedUnratedVideoChunks.length === 0;

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
                    <div>
                        <input
                            type="checkbox"
                            id="allCountries"
                            name="allCountries"
                            value="allCountries"
                            checked={shouldDiscoverAllCountries}
                            onChange={(event) => setShouldDiscoverAllCountries(event.target.checked)}
                        />
                        <label htmlFor="allCountries">All countries</label>
                    </div>
                    {
                        shouldDiscoverAllCountries
                            ? null
                            : (
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
                            )
                    }


                    <button
                        style={{
                            marginBottom: "1em",
                            marginTop: "1em",
                        }}
                        onClick={() => search()}
                    >
                        Discover Top Music
                    </button>
                </div>
                {
                    allRated
                        ? <p>{`Nothing more to show. Discover again or come back later :)`}</p>
                        : displayedUnratedVideoChunks.map((chunk) => (
                            <div key={chunk.chunkId} style={{
                                alignItems: "center",
                                display: "flex",
                                gap: "1em",
                            }}>
                                <button
                                    style={{
                                        height: '2em'
                                    }}
                                    onClick={() => {
                                        const newSet = new Set(ratedPlaylistChunkIds);
                                        newSet.add(chunk.chunkId);
                                        setRatedPlaylistChunkIds(newSet);
                                        const list = JSON.stringify(Array.from(newSet.values()));
                                        localStorage.setItem(StorageItem.ratedPlaylistChunkIds, list);
                                    }}>Mark rated</button>
                                <div
                                    style={{
                                        marginBottom: "1em",
                                    }}
                                >
                                    <a href={`http://www.youtube.com/watch_videos?video_ids=${chunk.videoIds.join(',')}`}>
                                        Open YouTube playlist #{chunk.chunkId}.
                                    </a>
                                </div>
                            </div>
                        ))
                }
                <section
                    style={{
                        marginTop: "1em"
                    }}
                >
                    <h1>Videos</h1>
                    <section>
                        {
                            unratedVideos.map((video, i) => (
                                <div
                                    key={video.id}
                                    style={{
                                        marginBottom: '1em'
                                    }}
                                >
                                    <div>
                                        <a href={`https://www.youtube.com/watch?v=${video.id}`} target="_blank">{i + 1}. {video.title}</a>
                                    </div>
                                </div>
                            ))
                        }
                    </section>
                </section>
            </div>
        </div>
    )
}
