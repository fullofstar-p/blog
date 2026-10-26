import request from './request'

/** 文件模块 /api/files（MinIO 对象存储） */

/**
 * 上传图片
 * @param {File} file 文件对象
 * @param {'avatar'|'cover'|'content'} category 上传分类
 * @param {(percent:number)=>void} [onProgress] 上传进度回调
 * @returns {Promise<{url:string, objectKey:string, originalName:string, size:number, contentType:string}>}
 */
export function uploadFile(file, category, onProgress) {
  const form = new FormData()
  form.append('file', file)
  form.append('category', category)

  return request.post('/files/upload', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
    onUploadProgress: (event) => {
      if (typeof onProgress !== 'function') return
      const total = event.total || (file && file.size) || 0
      onProgress(total > 0 ? Math.round((event.loaded / total) * 100) : 0)
    }
  })
}

export function deleteFile(objectKey) {
  return request.delete(`/files/${encodeURIComponent(objectKey)}`)
}
