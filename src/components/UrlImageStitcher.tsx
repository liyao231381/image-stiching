'use client'
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { DragDropContext, Droppable, Draggable } from 'react-beautiful-dnd';
import '../app/globals.css';
import { ClipLoader } from 'react-spinners';

const UrlImageStitcher: React.FC = () => {
  const [url, setUrl] = useState<string>(''); // 保存输入的 URL
  const [images, setImages] = useState<(string | null)[]>([]); // 保存获取到的图片 URL 数组，null 表示占位符
  const previewContainerRef = useRef<HTMLDivElement>(null); // 用于获取预览容器的 DOM 节点
  const [isLoading, setIsLoading] = useState<boolean>(false); // 标记是否正在加载图片
  const [imageWidth, setImageWidth] = useState<number>(300); // 图片的显示宽度，默认为 300px
  const [isDragging, setIsDragging] = useState<boolean>(false); // 标记是否正在拖动滚动条
  const [startX, setStartX] = useState<number>(0); // 滚动条拖动开始时的 X 坐标
  const [startY, setStartY] = useState<number>(0); // 滚动条拖动开始时的 Y 坐标
  const [scrollLeft, setScrollLeft] = useState<number>(0); // 滚动条水平方向的滚动距离
  const [scrollTop, setScrollTop] = useState<number>(0); // 滚动条垂直方向的滚动距离
  const [customFilename, setCustomFilename] = useState<string>(''); // 自定义文件名

  // 处理 URL 输入框的变化
  const handleUrlChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setUrl(event.target.value);
  };

  const fetchImages = async () => {
    setIsLoading(true);
    setImages([]);
    try {
      const response = await fetch(`/api/fetch-images?url=${encodeURIComponent(url)}`);
      if (!response.ok) {
        throw new Error('获取图片失败');
      }
      const data = await response.json();
      const imageUrls = data.images;
  
      // 使用 Promise.all 等待所有图片加载完成
      const loadedImages = await Promise.all(
        imageUrls.map(async (imageUrl: string) => {
          const loadedImage = await handleImageLoad(imageUrl);
          if (loadedImage && loadedImage.width >= 200 && loadedImage.height >= 200) {
            return loadedImage.url; // 只返回 URL
          } else {
            return null; // 加载失败或尺寸不符合要求，返回 null
          }
        })
      );
  
      // 更新 images 状态
      setImages(loadedImages);
    } catch (error) {
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleDownload = async () => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      console.error('无法获取 canvas 上下文');
      return;
    }
  
    console.log('images:', images);
  
    if (images.length === 0) {
      console.error('没有图片可以拼接');
      return;
    }
  
    // 创建临时的图片元素来获取图片的尺寸
    const tempImages = await Promise.allSettled(
      images.map((imageUrl) => {
        return new Promise<HTMLImageElement>((resolve) => {
          const img = new Image();
          img.crossOrigin = 'anonymous';
          img.onload = () => resolve(img);
          img.onerror = () => {
            console.error('图片加载失败:', imageUrl);
            resolve(null); // 加载失败时，resolve 一个 null 值
          };
          img.src = imageUrl;
        });
      })
    );
  
    // 过滤掉加载失败的图片 (fulfilled 状态且 value 不为 null 的)
    const validTempImages = tempImages
      .filter((result) => result.status === 'fulfilled' && result.value !== null)
      .map((result) => (result as PromiseFulfilledResult<HTMLImageElement>).value);
  
    console.log('validTempImages:', validTempImages);
  
    // 获取图片的原始尺寸
    const originalImageSizes = validTempImages.map((img) => ({
      width: img.naturalWidth,
      height: img.naturalHeight,
    }));
  
    // 计算 canvas 的宽度和高度
    const canvasWidth = imageWidth;
    const canvasHeight = originalImageSizes.reduce((sum, size) => sum + (imageWidth / size.width) * size.height, 0);
    canvas.width = canvasWidth;
    canvas.height = canvasHeight;
  
    let yOffset = 0;
    for (let i = 0; i < validTempImages.length; i++) {
      const img = validTempImages[i];
      const originalWidth = originalImageSizes[i].width;
      const originalHeight = originalImageSizes[i].height;
      const scale = imageWidth / originalWidth;
      ctx.drawImage(img, 0, yOffset, imageWidth, originalHeight * scale);
      yOffset += originalHeight * scale;
    }
  
    // 将 canvas 转换为 blob 并下载
    canvas.toBlob(
      (blob) => {
        if (blob) {
          const link = document.createElement('a');
          link.href = URL.createObjectURL(blob);
          link.download = `${customFilename}.png`;
          link.style.display = 'none';
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          URL.revokeObjectURL(link.href);
        } else {
          console.error('无法从 canvas 创建 blob');
        }
      },
      'image/png'
    );
  };
  
  // 加载图片并返回图片的 URL、宽度和高度
  const handleImageLoad = async (imageUrl: string): Promise<{ url: string, width: number, height: number } | null> => {
    // 返回一个包含 URL 和尺寸的对象，如果失败则返回 null
    const proxyImageUrl = new URL('/api/proxy-image', window.location.origin);
    proxyImageUrl.searchParams.set('url', imageUrl);
    try {
      const response = await fetch(proxyImageUrl.toString());
      if (!response.ok) {
        throw new Error(`获取图片 ${imageUrl} 失败，状态码：${response.status}`);
      }
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);

      return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
          resolve({ url: blobUrl, width: img.naturalWidth, height: img.naturalHeight });
        };
        img.onerror = () => {
          console.error('加载图片失败:', imageUrl);
          resolve(null); // 图片加载失败，返回 null
        };
        img.src = blobUrl;
      });
    } catch (error) {
      console.error('加载图片失败:', imageUrl, error);
      return null;
    }
  };

  // 处理鼠标滚轮事件
  const handleWheel = (event: React.WheelEvent<HTMLDivElement>) => {
    event.preventDefault();
    const deltaY = event.deltaY;
    if (previewContainerRef.current) {
      previewContainerRef.current.scrollTop += deltaY;
    }
  };

  // 处理鼠标按下事件
  const handleMouseDown = (event: React.MouseEvent<HTMLDivElement>) => {
    setIsDragging(true);
    setStartX(event.pageX - scrollLeft);
    setStartY(event.pageY - scrollTop);
  };

  // 处理鼠标抬起事件
  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // 处理鼠标移动事件，实现滚动条拖动
  const handleMouseMove = useCallback(
    (event: MouseEvent) => {
      if (!isDragging) return;
      const newScrollLeft = event.pageX - startX;
      const newScrollTop = event.pageY - startY;
      setScrollLeft(newScrollLeft);
      setScrollTop(newScrollTop);
      if (previewContainerRef.current) {
        previewContainerRef.current.scrollTo({
          top: newScrollTop,
          left: newScrollLeft,
        });
      }
    },
    [isDragging, startX, startY, previewContainerRef]
  );

  // 使用 useEffect 监听 isDragging、startX、startY 和 handleMouseMove 的变化，添加和移除鼠标移动和抬起事件监听器
  useEffect(() => {
    if (previewContainerRef.current) {
      previewContainerRef.current.addEventListener('mousemove', handleMouseMove);
      previewContainerRef.current.addEventListener('mouseup', handleMouseUp);
    }
    return () => {
      if (previewContainerRef.current) {
        previewContainerRef.current.removeEventListener('mousemove', handleMouseMove);
        previewContainerRef.current.removeEventListener('mouseup', handleMouseUp);
      }
    };
  }, [isDragging, startX, startY, handleMouseMove]);

  // 处理单张图片下载
  const handleDownloadImage = (imageUrl: string) => {
    const now = new Date();
    const year = now.getFullYear().toString().slice(-2); // 获取年份的后两位
    const month = (now.getMonth() + 1).toString().padStart(2, '0'); // 月份从 0 开始，所以要 +1，并确保是两位数
    const day = now.getDate().toString().padStart(2, '0'); // 确保日期是两位数
    const date = `${year}${month}${day}`;
    const hours = now.getHours().toString().padStart(2, '0'); // 确保小时是两位数
    const minutes = now.getMinutes().toString().padStart(2, '0'); // 确保分钟是两位数
    const time = `${hours}${minutes}`;
    // 获取当前图片在 validImages 数组中的索引
    const validImages = images.filter((img) => img !== null) as string[];
    const index = validImages.indexOf(imageUrl);

    const link = document.createElement('a');
    link.href = imageUrl;
    link.download = `${customFilename}${date}${time}-${index + 1}.png`; // 文件名格式：自定义文件名-日期-时间-序号.png
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // 处理移除图片
  const handleRemoveImage = (indexToRemove: number) => {
    setImages((prevImages) => prevImages.filter((_, index) => index !== indexToRemove));
  };

  // 处理自定义文件名输入框的变化
  const handleFilenameChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setCustomFilename(event.target.value);
  };

  // 处理一键下载所有图片
  const handleBatchDownload = () => {
    if (images.length === 0) {
      console.error('没有图片可以下载');
      return;
    }

    const validImages = images.filter((img) => img !== null) as string[];
    validImages.forEach((imageUrl, index) => {
      const link = document.createElement('a');
      link.href = imageUrl;
      link.download = `${customFilename}${index + 1}.png`; // 文件名格式：自定义文件名+序号.png
      link.style.display = 'none';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    });
  };

  // 处理拖动结束事件
  const handleOnDragEnd = (result: any) => {
    if (!result.destination) return; // 如果没有目的地，则返回

    const items = Array.from(images);
    const [reorderedItem] = items.splice(result.source.index, 1); // 从源位置移除拖动的元素
    items.splice(result.destination.index, 0, reorderedItem); // 将拖动的元素插入到目标位置

    setImages(items); // 更新 images 状态
  };

  return (
    <div className="container mx-auto w-full p-2 flex flex-col md:flex-row">
      {/* 左侧内容 */}
      <div className="md:w-1/3 lg:w-1/4 mb-4 md:mb-0 md:mr-10">
        <div className="text-center mb-4 md:mb-8">
          <h1 className="font-lora text-2xl md:text-3xl lg:text-4xl font-bold text-gray-800">链接拼图</h1>
        </div>
        <div className="font-lora font-light mb-4 flex md:flex-col md:items-center">
          <input
            type="text"
            placeholder="输入网页链接"
            value={url}
            onChange={handleUrlChange}
            className="border border-gray-300 px-4 py-2 rounded w-full focus:outline-none focus:shadow-outline"
          />
          <button
            onClick={fetchImages}
            className="font-lora bg-blue-500 hover:bg-blue-700 text-white text-LG py-2 px-4 rounded ml-2  md:mt-4 w-36 md:w-auto focus:outline-none focus:shadow-outline"
          >
            获取图片
          </button>
        </div>

        {/* 图片宽度控制和下载按钮 */}
        <div className="flex flex-col items-center mb-4">
          <div className="flex-col lg:flex-row md:flex-row items-center w-full mt-2">
            <div className='flex items-center'>
              <input
                type="text"
                placeholder="自定义文件名"
                value={customFilename}
                onChange={handleFilenameChange}
                className="font-lora border border-gray-300 px-4 py-2 rounded w-full placeholder-gray-400 focus:outline-none focus:shadow-outline placeholder-opacity-50 text-right"
              />
              <span className="ml-2 text-gray-800">.png</span>
            </div>
            <div className="flex md:flex-row lg:flex-row items-center justify-center mb-2 mt-4 md:mb-0 w-full md:w-auto">
              <label htmlFor="image-width" className="font-lora text-xl block mb-1 mr-2 w-40text-gray-800">
                宽度
              </label>
              <input
                type="number"
                id="image-width"
                min="100"
                max="1000"
                step="50"
                value={imageWidth}
                onChange={(e) => setImageWidth(parseInt(e.target.value))}
                className="font-lora border border-gray-300 px-4 py-2 rounded focus:outline-none focus:shadow-outline"
              />
              <label htmlFor="image-width" className="font-lora text-xl block mb-1 ml-2 w-40text-gray-800">
                像素
              </label>
            </div>
            <div className="flex justify-center items-center mt-4 w-full md:w-auto">
              <button
                onClick={handleBatchDownload} // 新增的按钮和事件处理函数
                className="font-lora bg-green-500 hover:bg-green-600 text-white py-2 px-2 rounded mr-2"
              >
                一键下载
              </button>
              <button
                onClick={handleDownload}
                className="font-lora bg-orange-500 hover:bg-orange-600 text-white py-2 px-2 rounded ml-2"
              >
                拼接图片
              </button>
            </div>
          </div>
        </div>
        {/* 图片加载指示器 */}
        {isLoading && (
          <div className="font-lora mb-4 flex justify-center items-center">
            <ClipLoader color="#4A90E2" loading={isLoading} size={35} />
            <span className="ml-2 text-xl text-gray-800">Loading images...</span>
          </div>
        )}
      </div>
      {/* 右侧预览容器 */}
      <DragDropContext onDragEnd={handleOnDragEnd}>
        <Droppable droppableId="images">
          {(provided) => (
            <div
              className="image-container md:w-2/3 overflow-auto border border-gray-300 relative flex flex-col items-center scrollbar-modern"
              style={{ maxHeight: '100vh', cursor: isDragging ? 'grabbing' : 'grab' }}
              onMouseDown={handleMouseDown}
              onWheel={handleWheel}
              {...provided.droppableProps}
              ref={provided.innerRef}
            >
              {images.map((imageUrl, index) => (
                <Draggable key={index} draggableId={index.toString()} index={index}>
                  {(provided) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.draggableProps}
                      {...provided.dragHandleProps}
                      className="image-wrapper relative"
                      style={{
                        width: `${imageWidth}px`,
                        display: 'flex',
                        justifyContent: 'center',
                        userSelect: 'none', // 防止拖动时选中文字
                        ...provided.draggableProps.style, // 应用 react-beautiful-dnd 提供的样式
                      }}
                    >
                      {imageUrl ? (
                        <>
                          <img src={imageUrl} alt={`预览 ${index}`} style={{ width: '100%' }} />
                          <div className="overlay absolute top-0 left-0 w-full h-full flex justify-between p-1 opacity-0 hover:opacity-100 transition-opacity duration-200">
                            <button
                              onClick={() => handleDownloadImage(imageUrl)}
                              className="w-10 h-10 bg-gray-200/80 hover:bg-gray-800/30 text-white font-bold py-1 px-2 rounded focus:outline-none focus:shadow-outline"
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="feather feather-download"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                            </button>
                            <button
                              onClick={() => handleRemoveImage(index)}
                              className="w-10 h-10 bg-red-500/20 hover:bg-red-500 text-white font-bold py-1 px-2 rounded focus:outline-none focus:shadow-outline"
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="feather feather-x"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                            </button>
                          </div>
                        </>
                      ) : (
                        <div
                          className="animate-pulse bg-gray-300 relative flex items-center justify-center"
                          style={{ width: '100%', height: `${imageWidth}px` }}
                        >
                          <ClipLoader color="#4A90E2" loading={true} size={35} />
                          <div className="overlay absolute top-0 left-0 w-full h-full flex justify-between p-1 hover:opacity-100 transition-opacity duration-200">
                            <button
                              onClick={() => handleRemoveImage(index)}
                              className="absolute top-1 right-1 w-10 h-10 bg-red-500/20 hover:bg-red-500 text-white font-bold py-1 px-2 rounded focus:outline-none focus:shadow-outline"
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" className="feather feather-x"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </Draggable>
              ))}
              {provided.placeholder}
            </div>
          )}
        </Droppable>
      </DragDropContext>
    </div>
  );
};

export default UrlImageStitcher;
