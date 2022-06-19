export interface ListMostPopularVideosParams {

}

export interface ListMostPopularVideosResponse {
    items: Array<{
        id: string,
        snippet: {
            title: string,
        },
        statistics: {
            viewCount: string,
        }
    }>;
    // pageInfo: {
    //     totalResults: number;
    //     resultsPerPage: number;
    // },

}

export interface Video {
    id: string,
        title: string,
        viewCount: number,
}

export interface ListMostPopularVideosResult {
    items: Array<Video>;
}

export type Rating =  'like' | 'dislike' | 'none' | 'unspecified' 

/**
 * https://developers.google.com/youtube/v3/docs/videos/getRating
 */
export interface GetRatingResult {
    items: Array<{ videoId: string, rating: Rating }>;
}


// curl \
//   "https://youtube.googleapis.com/youtube/v3/videos?maxResults=30&part=contentDetails%2Cid%2Cplayer%2Csnippet%2Cstatistics%2Cstatus%2CtopicDetails&videoCategoryId=10&chart=mostPopular&regionCode=pl&key=${KEY}" \
//   --header "Authorization: Bearer ${TOKEN}" \
//   --header 'Accept: application/json' \
//   --compressed

export interface YouTubeProps {
    token: string;
    apiKey: string;
}

export class YouTube {
    token: string;
    apiKey: string;

    constructor({
        token,
        apiKey,
    }: YouTubeProps) {
        this.apiKey = apiKey;
        this.token = token;
    }

    async listMostPopularVideos(regionCode: string): Promise<ListMostPopularVideosResult> {
        const urlSearchParams = new URLSearchParams({
            maxResults: '30',
            part: 'id,snippet,statistics',
            videoCategoryId: '10',
            chart: 'mostPopular',
            regionCode,
            fields: 'items(id,snippet/title,statistics(likeCount,viewCount))',
            key: this.apiKey,
        })

        const response = await fetch(`https://youtube.googleapis.com/youtube/v3/videos?${urlSearchParams.toString()}`, {
            method: 'GET',
            headers: {
                Authorization: `Bearer ${this.token}`,
                Accept: 'application/json'
            }
        });

        const body = await response.json() as ListMostPopularVideosResponse;

        return {
            items: body.items.map((item) => ({
                id: item.id,
                title: item.snippet.title,
                viewCount: Number.parseInt(item.statistics.viewCount)
            }))
        }
    }

    async getRating(videoIds: string[]): Promise<GetRatingResult> {
        const urlSearchParams = new URLSearchParams({
            id: videoIds.join(','),
            key: this.apiKey,
        })

        const response = await fetch(`https://youtube.googleapis.com/youtube/v3/videos/getRating?${urlSearchParams.toString()}`, {
            method: 'GET',
            headers: {
                Authorization: `Bearer ${this.token}`,
                Accept: 'application/json'
            }
        });

        return response.json();
    }
}


// curl \
//   'https://youtube.googleapis.com/youtube/v3/videos/getRating?id=26dfFM2FDR8%2CJ9bniJsyb1E&key=369453766252-jktags0v36ha027d1is83tjagm690t48.apps.googleusercontent.com' \
//   --header 'Authorization: Bearer ya29.a0ARrdaM9hVizLl2DhzA9BcmWfKnQkbiy_GB1mf8Wh7xZB7Sfx7gt8zKWTJ2sVi5oCqybcNUpJl96hTRn4pPFLfz1KZssmZSgLW3PbTrso5OXSdEePlz32dGcvNvjpt8R6uFN1_xeNV31v5bVIFE54AvJaJCUJ' \
//   --header 'Accept: application/json' \
//   --compressed