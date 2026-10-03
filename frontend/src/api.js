import axios from 'axios'

const BASE = "https://customeriq-backend.onrender.com"

export const api = {
  // Dataset
  datasetInfo:   ()               => axios.get(`${BASE}/dataset/info`).then(r => r.data),
  resetDataset:  ()               => axios.delete(`${BASE}/dataset`).then(r => r.data),

  // Upload flow (two-step)
  uploadCSV:     (file)           => {
    const fd = new FormData()
    fd.append('file', file)
    return axios.post(`${BASE}/upload`, fd).then(r => r.data)
  },
  confirmUpload: (token, col_map) => axios.post(`${BASE}/upload/confirm`, { token, col_map }).then(r => r.data),

  // Analysis
  elbow:    (maxK = 10) => axios.get(`${BASE}/elbow?max_k=${maxK}`).then(r => r.data),
  cluster:  (k = 5)     => axios.get(`${BASE}/cluster?k=${k}`).then(r => r.data),
  summary:  (k = 5)     => axios.get(`${BASE}/summary?k=${k}`).then(r => r.data),
  customers:(k = 5)     => axios.get(`${BASE}/customers?k=${k}`).then(r => r.data),
  predict:  (data)      => axios.post(`${BASE}/predict`, data).then(r => r.data),
  recommend:(data)      => axios.post(`${BASE}/recommend`, data).then(r => r.data),
  modelComparison: ()   => axios.get(`${BASE}/model-comparison`).then(r => r.data),
  report:   (k = 5)     => axios.get(`${BASE}/report?k=${k}`, { responseType: 'blob' }).then(r => r.data),
}