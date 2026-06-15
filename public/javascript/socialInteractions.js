// Xử lý các nút bấm mượt mà qua AJAX

document.addEventListener('DOMContentLoaded', () => {
    // 1. Favorite Logic
    const favBtns = document.querySelectorAll('.btn-favorite');
    favBtns.forEach(btn => {
        btn.addEventListener('click', async (e) => {
            e.preventDefault();
            const restaurantId = btn.getAttribute('data-restaurant-id');
            if(!restaurantId) return;

            try {
                const response = await fetch(`/restaurants/${restaurantId}/favorite`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' }
                });
                
                if(response.redirected) {
                    // Nếu user chưa đăng nhập, backend redirect ra trang login
                    window.location.href = response.url;
                    return;
                }

                const data = await response.json();
                if(data.success) {
                    // Đổi giao diện nút bấm
                    if(data.isFavorited) {
                        btn.innerHTML = '<i class="fas fa-heart mr-2"></i> ĐÃ THÍCH';
                        btn.classList.replace('text-gray-600', 'text-rose-600');
                        btn.classList.replace('bg-white', 'bg-rose-50');
                        btn.classList.add('border-rose-200');
                    } else {
                        btn.innerHTML = '<i class="far fa-heart mr-2"></i> YÊU THÍCH';
                        btn.classList.replace('text-rose-600', 'text-gray-600');
                        btn.classList.replace('bg-rose-50', 'bg-white');
                        btn.classList.remove('border-rose-200');
                    }
                }
            } catch (error) {
                console.error("Lỗi:", error);
            }
        });
    });

    // 2. Follow Logic
    const followBtns = document.querySelectorAll('.btn-follow');
    followBtns.forEach(btn => {
        btn.addEventListener('click', async (e) => {
            e.preventDefault();
            const userId = btn.getAttribute('data-user-id');
            if(!userId) return;

            try {
                const response = await fetch(`/users/${userId}/follow`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' }
                });

                if(response.redirected) {
                    window.location.href = response.url;
                    return;
                }

                const data = await response.json();
                if(data.success) {
                    if(data.isFollowing) {
                        btn.innerText = 'Đang theo dõi';
                        btn.classList.replace('bg-blue-600', 'bg-gray-200');
                        btn.classList.replace('text-white', 'text-gray-800');
                    } else {
                        btn.innerText = 'Theo dõi';
                        btn.classList.replace('bg-gray-200', 'bg-blue-600');
                        btn.classList.replace('text-gray-800', 'text-white');
                    }
                }
            } catch (error) {
                console.error("Lỗi:", error);
            }
        });
    });

    // 3. Like Logic
    const likeBtns = document.querySelectorAll('.btn-like');
    likeBtns.forEach(btn => {
        btn.addEventListener('click', async (e) => {
            e.preventDefault();
            const reviewId = btn.getAttribute('data-review-id');
            if(!reviewId) return;

            try {
                const response = await fetch(`/reviews/${reviewId}/like`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' }
                });

                if(response.redirected) {
                    window.location.href = response.url;
                    return;
                }

                const data = await response.json();
                if(data.success) {
                    const icon = btn.querySelector('i');
                    const countSpan = btn.querySelector('.like-count');

                    if(data.isLiked) {
                        icon.classList.replace('far', 'fas');
                        icon.classList.add('text-red-500');
                    } else {
                        icon.classList.replace('fas', 'far');
                        icon.classList.remove('text-red-500');
                    }
                    
                    if(countSpan) {
                        countSpan.innerText = data.likeCount;
                    }

                    // Nếu Like xóa mất Dislike thì cập nhật lại UI của nút Dislike
                    if(data.isDislikedRemoved) {
                        const dislikeBtn = document.querySelector(`.btn-dislike[data-review-id="${reviewId}"]`);
                        if(dislikeBtn) {
                            const dIcon = dislikeBtn.querySelector('i');
                            const dCountSpan = dislikeBtn.querySelector('.dislike-count');
                            dIcon.classList.replace('fas', 'far');
                            dIcon.classList.remove('text-blue-500');
                            if(dCountSpan) dCountSpan.innerText = data.dislikeCount;
                        }
                    }
                }
            } catch (error) {
                console.error("Lỗi:", error);
            }
        });
    });

    // 4. Dislike Logic
    const dislikeBtns = document.querySelectorAll('.btn-dislike');
    dislikeBtns.forEach(btn => {
        btn.addEventListener('click', async (e) => {
            e.preventDefault();
            const reviewId = btn.getAttribute('data-review-id');
            if(!reviewId) return;

            try {
                const response = await fetch(`/reviews/${reviewId}/dislike`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' }
                });

                if(response.redirected) {
                    window.location.href = response.url;
                    return;
                }

                const data = await response.json();
                if(data.success) {
                    const icon = btn.querySelector('i');
                    const countSpan = btn.querySelector('.dislike-count');

                    if(data.isDisliked) {
                        icon.classList.replace('far', 'fas');
                        icon.classList.add('text-blue-500');
                    } else {
                        icon.classList.replace('fas', 'far');
                        icon.classList.remove('text-blue-500');
                    }
                    
                    if(countSpan) {
                        countSpan.innerText = data.dislikeCount;
                    }

                    // Nếu Dislike xóa mất Like thì cập nhật lại UI của nút Like
                    if(data.isLikedRemoved) {
                        const likeBtn = document.querySelector(`.btn-like[data-review-id="${reviewId}"]`);
                        if(likeBtn) {
                            const lIcon = likeBtn.querySelector('i');
                            const lCountSpan = likeBtn.querySelector('.like-count');
                            lIcon.classList.replace('fas', 'far');
                            lIcon.classList.remove('text-red-500');
                            if(lCountSpan) lCountSpan.innerText = data.likeCount;
                        }
                    }
                }
            } catch (error) {
                console.error("Lỗi:", error);
            }
        });
    });
});
