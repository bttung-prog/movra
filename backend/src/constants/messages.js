export const COMMON_MESSAGES = {
  SUCCESS: "Thành công",
  CREATED: "Tạo thành công",
  UPDATED: "Cập nhật thành công",
  DELETED: "Xóa thành công",
  RESTORED: "Khôi phục thành công",
  ERROR: "Đã xảy ra lỗi",
  SERVER_ERROR: "Lỗi máy chủ nội bộ",
  UNAUTHORIZED: "Chưa được xác thực",
  FORBIDDEN: "Bạn không có quyền thực hiện thao tác này",
  FORBIDDEN_DEFAULT: "Truy cập bị từ chối",
  VALIDATION_ERROR: "Dữ liệu không hợp lệ",
  NOT_FOUND: "Không tìm thấy dữ liệu",
  ALL_FIELDS_REQUIRED: "Vui lòng cung cấp đầy đủ thông tin các trường bắt buộc",
};

export const UPLOAD_MESSAGES = {
  INVALID_IMAGE_TYPE: "Chỉ chấp nhận file ảnh định dạng JPG, JPEG, PNG, WEBP!",
  INVALID_IMAGE_CONTENT: "File tải lên không phải ảnh hợp lệ.",
};

export const AUTH_MESSAGES = {
  REGISTER_SUCCESS: "Đăng ký tài khoản thành công",
  REGISTER_OTP_SENT: "Mã OTP xác nhận đăng ký đã được gửi đến email",
  REGISTER_OTP_VERIFIED: "Xác thực OTP đăng ký thành công",
  PASSWORD_RESET_OTP_SENT:
    "Nếu email đã đăng ký, mã OTP đặt lại mật khẩu đã được gửi",
  PASSWORD_RESET_SUCCESS: "Đặt lại mật khẩu thành công",
  CHANGE_PASSWORD_SUCCESS: "Đổi mật khẩu thành công",
  INVALID_OR_EXPIRED_OTP:
    "Mã OTP không hợp lệ, đã hết hạn hoặc vượt quá số lần thử",
  LOGIN_SUCCESS: "Đăng nhập thành công",
  REFRESH_TOKEN_SUCCESS: "Làm mới mã truy cập thành công",
  LOGOUT_SUCCESS: "Đăng xuất thành công",
  INVALID_CREDENTIALS: "Email hoặc mật khẩu không chính xác",
  ACCOUNT_INACTIVE_OR_LOCKED: "Tài khoản chưa được kích hoạt hoặc đã bị khóa",
  INVALID_OR_EXPIRED_REFRESH_TOKEN: "Mã làm mới không hợp lệ hoặc đã hết hạn",
  TOKEN_EXPIRED: "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.",
  INVALID_ACCESS_TOKEN: "Mã truy cập không hợp lệ",
  USER_NOT_FOUND: "Không tìm thấy người dùng",
  DRIVER_PROFILE_MISSING:
    "Tài khoản tài xế chưa được thiết lập hồ sơ. Vui lòng liên hệ Quản trị viên.",
  DRIVER_NO_WAREHOUSE:
    "Tài khoản tài xế chưa được phân bổ vào kho nào. Vui lòng liên hệ Quản trị viên.",
  STAFF_PROFILE_MISSING:
    "Tài khoản nhân viên kho chưa được thiết lập hồ sơ. Vui lòng liên hệ Quản trị viên.",
  STAFF_NO_WAREHOUSE:
    "Tài khoản nhân viên kho chưa được phân bổ vào kho nào. Vui lòng liên hệ Quản trị viên.",
  DISPATCHER_PROFILE_MISSING:
    "Tài khoản điều phối viên chưa được thiết lập hồ sơ. Vui lòng liên hệ Quản trị viên.",
  DISPATCHER_NO_WAREHOUSE:
    "Tài khoản điều phối viên chưa được phân bổ vào kho nào. Vui lòng liên hệ Quản trị viên.",
};

export const USER_MESSAGES = {
  GET_PROFILE_SUCCESS: "Lấy thông tin người dùng thành công",
  UPDATE_PROFILE_SUCCESS: "Cập nhật thông tin người dùng thành công",
  EMAIL_EXISTS: "Email đã tồn tại",
  PHONE_EXISTS: "Số điện thoại đã tồn tại",
  NOT_FOUND: "Không tìm thấy người dùng",
  OLD_PASSWORD_INCORRECT: "Mật khẩu cũ không chính xác",
  DRIVER_DATA_REQUIRED: "Thông tin tài xế là bắt buộc khi vai trò là tài xế",
  DRIVER_ROLE_INVALID: "Người dùng phải có vai trò tài xế để tạo hồ sơ tài xế",
  STAFF_DATA_REQUIRED:
    "Thông tin nhân viên là bắt buộc khi vai trò là nhân viên kho",
  DISPATCHER_DATA_REQUIRED:
    "Thông tin điều phối viên là bắt buộc khi vai trò là điều phối viên",
  DISPATCHER_ROLE_INVALID:
    "Người dùng phải có vai trò điều phối viên để tạo hồ sơ điều phối",
  DISPATCHER_USER_NOT_ACTIVE:
    "Chỉ tài khoản điều phối viên đang hoạt động mới được tạo hồ sơ",
  ROLE_STATUS_CHANGE_REQUIRES_DEDICATED_OPERATION:
    "Vui lòng dùng chức năng thay đổi vai trò hoặc trạng thái riêng để cập nhật quyền truy cập tài khoản",
};

export const ADMIN_MESSAGES = {
  GET_ALL_USERS_SUCCESS: "Lấy danh sách người dùng thành công",
  SEARCH_USERS_SUCCESS: "Tìm kiếm người dùng thành công",
  GET_USER_SUCCESS: "Lấy thông tin người dùng thành công",
  CREATE_USER_SUCCESS: "Tạo người dùng thành công",
  UPDATE_USER_SUCCESS: "Cập nhật người dùng thành công",
  CHANGE_ROLE_SUCCESS: "Thay đổi vai trò người dùng thành công",
  CHANGE_STATUS_SUCCESS: "Thay đổi trạng thái người dùng thành công",
  RESET_PASSWORD_SUCCESS: "Đặt lại mật khẩu thành công",
  DEACTIVATE_USER_SUCCESS: "Khóa người dùng thành công",
  ACTIVATE_USER_SUCCESS: "Kích hoạt người dùng thành công",
  GET_DASHBOARD_STATS_SUCCESS: "Lấy thống kê bảng điều khiển thành công",
  CANNOT_DEACTIVATE_SELF:
    "Quản trị viên không thể tự khóa hoặc vô hiệu hóa tài khoản của chính mình",
  CANNOT_DEMOTE_SELF:
    "Quản trị viên không thể tự hạ cấp vai trò tài khoản của mình",
  INVALID_ROLE: "Vai trò không hợp lệ",
  INVALID_STATUS: "Trạng thái không hợp lệ",
  CANNOT_MODIFY_SUPER_ADMIN: "Không thể thay đổi tài khoản siêu quản trị viên",
};

export const DASHBOARD_MESSAGES = {
  GET_OVERVIEW_SUCCESS: "Lấy số liệu tổng quan thành công",
  GET_DRIVER_PERFORMANCE_SUCCESS: "Lấy danh sách hiệu suất tài xế thành công",
  GET_FLEET_STATUS_SUCCESS: "Lấy tình trạng đội xe và chuyến xe thành công",
};

export const WAREHOUSE_MESSAGES = {
  CREATE_SUCCESS: "Tạo kho thành công",
  GET_ALL_SUCCESS: "Lấy danh sách kho thành công",
  GET_ONE_SUCCESS: "Lấy thông tin kho thành công",
  UPDATE_SUCCESS: "Cập nhật kho thành công",
  UPDATE_MANAGER_SUCCESS: "Cập nhật quản lý kho thành công",
  CHANGE_STATUS_SUCCESS: "Thay đổi trạng thái kho thành công",
  DELETE_SUCCESS: "Xóa kho thành công",
  RESTORE_SUCCESS: "Khôi phục kho thành công",
  GET_STATS_SUCCESS: "Lấy thống kê kho thành công",
  GET_STAFF_SUCCESS: "Lấy danh sách nhân viên kho thành công",
  NOT_FOUND: "Không tìm thấy kho",
  ALREADY_DELETED: "Kho đã bị xóa trước đó",
  NOT_ACTIVE: "Kho hiện không hoạt động",
  NO_ACTIVE_WAREHOUSES: "Không có kho đang hoạt động để nhận đơn",
  COORDINATES_NOT_CONFIGURED:
    "Cần cấu hình tọa độ cho tất cả kho đang hoạt động trước khi tự động phân kho",
  MANAGER_NOT_FOUND: "Không tìm thấy người quản lý kho",
  MANAGER_NOT_ACTIVE: "Tài khoản quản lý kho đang không hoạt động",
  MANAGER_ROLE_INVALID: (role) =>
    `Quản lý phải có vai trò 'admin' hoặc 'warehouse_staff'. Vai trò hiện tại là '${role}'`,
  ALREADY_EXISTS: "Kho đã tồn tại",
  NAME_EXISTS: "Tên kho đã tồn tại",
  INVALID_STATUS: "Trạng thái kho không hợp lệ",
  CANNOT_DELETE_HAS_STOCK: (count) =>
    `Không thể xóa kho: Kho vẫn còn ${count} mặt hàng tồn kho. Vui lòng chuyển hoặc xuất hết hàng trước.`,
  CANNOT_DEACTIVATE_HAS_STOCK: (count) =>
    `Không thể ngừng hoạt động kho: Kho vẫn còn ${count} mặt hàng tồn kho. Vui lòng chuyển hoặc xuất hết hàng trước.`,
  CANNOT_DEACTIVATE_HAS_ACTIVE_PERSONNEL: (
    dispatcherCount,
    driverCount,
    staffCount,
  ) =>
    `Không thể ngừng hoạt động hoặc xóa kho: Kho đang được gán cho ${dispatcherCount} điều phối viên, ${driverCount} tài xế và ${staffCount} nhân viên kho đang hoạt động. Vui lòng điều chuyển hoặc cho nghỉ họ trước.`,
  NOT_DELETED: "Kho chưa bị xóa",
  CANNOT_RESTORE_NAME_EXISTS:
    "Không thể khôi phục: Đã tồn tại một kho đang hoạt động có cùng tên này",
  ACCESS_DENIED: "Bạn không có quyền truy cập tài nguyên của kho khác",
  DISPATCHER_NOT_ASSIGNED: "Điều phối viên chưa được phân bổ vào kho nào",
  STAFF_NOT_ASSIGNED: "Nhân viên kho chưa được phân bổ vào kho nào",
  INVALID_WAREHOUSE_REF:
    "Tham chiếu kho không hợp lệ: Tài nguyên chưa được gán vào kho hợp lệ",
};

export const VEHICLE_MESSAGES = {
  CREATE_TYPE_SUCCESS: "Tạo loại phương tiện thành công",
  GET_ALL_TYPES_SUCCESS: "Lấy danh sách loại phương tiện thành công",
  GET_DELETED_TYPES_SUCCESS: "Lấy danh sách loại phương tiện đã xóa thành công",
  GET_TYPE_SUCCESS: "Lấy thông tin loại phương tiện thành công",
  UPDATE_TYPE_SUCCESS: "Cập nhật loại phương tiện thành công",
  DELETE_TYPE_SUCCESS: "Xóa loại phương tiện thành công",
  RESTORE_TYPE_SUCCESS: "Khôi phục loại phương tiện thành công",
  TYPE_EXISTS: "Loại phương tiện đã tồn tại",
  TYPE_NOT_FOUND: "Không tìm thấy loại phương tiện",
  TYPE_ALREADY_DELETED: "Loại phương tiện đã bị xóa",
  TYPE_NAME_EXISTS: "Tên loại phương tiện đã tồn tại",
  TYPE_CANNOT_DELETE_ASSIGNED: (count) =>
    `Không thể xóa loại phương tiện: Hiện đang được gán cho ${count} phương tiện`,
  TYPE_NOT_DELETED: "Loại phương tiện chưa bị xóa",

  CREATE_SUCCESS: "Tạo phương tiện thành công",
  GET_ALL_SUCCESS: "Lấy danh sách phương tiện thành công",
  GET_ONE_SUCCESS: "Lấy thông tin phương tiện thành công",
  GET_EXPIRED_REGISTRATION_SUCCESS:
    "Lấy danh sách phương tiện hết hạn đăng kiểm thành công",
  GET_EXPIRED_INSURANCE_SUCCESS:
    "Lấy danh sách phương tiện hết hạn bảo hiểm thành công",
  UPDATE_SUCCESS: "Cập nhật thông tin phương tiện thành công",
  CHANGE_STATUS_SUCCESS: "Thay đổi trạng thái phương tiện thành công",
  DELETE_SUCCESS: "Xóa phương tiện thành công",
  RESTORE_SUCCESS: "Khôi phục phương tiện thành công",
  UPDATE_ODOMETER_SUCCESS: "Cập nhật chỉ số công-tơ-mét thành công",
  RENEW_REGISTRATION_SUCCESS: "Gia hạn đăng kiểm phương tiện thành công",
  RENEW_INSURANCE_SUCCESS: "Gia hạn bảo hiểm phương tiện thành công",
  PLATE_EXISTS: "Biển số xe đã tồn tại",
  NOT_FOUND: "Không tìm thấy phương tiện",
  DRIVER_PROFILE_NOT_FOUND: "Không tìm thấy hồ sơ tài xế",
  UPDATE_ODO_ONLY_ASSIGNED:
    "Bạn chỉ có thể cập nhật chỉ số công-tơ-mét cho xe được gán cho mình",
  ODO_LESS_THAN_CURRENT:
    "Chỉ số công-tơ-mét mới không được nhỏ hơn chỉ số hiện tại",
  VEHICLE_NOT_MATCH_TRIP:
    "Phương tiện không khớp với phương tiện được gán cho chuyến đi này",
  DRIVER_NOT_MATCH_TRIP:
    "Tài xế không khớp với tài xế được gán cho chuyến đi này",
  VEHICLE_IN_USE:
    "Phương tiện không thể sử dụng vì đang trong quá trình vận hành",
  VEHICLE_STATUS_INVALID: (status) =>
    `Phương tiện không thể sử dụng vì trạng thái là '${status}'`,
  START_ODO_LESS_THAN_CURRENT: (startOdo, current) =>
    `Số km ban đầu (${startOdo}) không được nhỏ hơn chỉ số công-tơ-mét hiện tại (${current || 0})`,

  CHECK_IN_SUCCESS: "Nhận phương tiện (check-in) thành công",
  CHECK_OUT_SUCCESS: "Trả phương tiện (check-out) thành công",
  GET_ALL_LOGS_SUCCESS: "Lấy danh sách nhật ký sử dụng xe thành công",
  GET_LOG_SUCCESS: "Lấy thông tin nhật ký sử dụng xe thành công",
  GET_LOGS_BY_VEHICLE_SUCCESS:
    "Lấy danh sách nhật ký theo phương tiện thành công",
  GET_LOGS_BY_DRIVER_SUCCESS: "Lấy danh sách nhật ký theo tài xế thành công",
  GET_LOGS_BY_TRIP_SUCCESS: "Lấy danh sách nhật ký theo chuyến xe thành công",
  GET_STATS_SUCCESS: "Lấy thống kê sử dụng phương tiện thành công",
  UPDATE_LOG_SUCCESS: "Cập nhật nhật ký sử dụng xe thành công",
  DELETE_LOG_SUCCESS: "Xóa nhật ký sử dụng xe thành công",
  RESTORE_LOG_SUCCESS: "Khôi phục nhật ký sử dụng xe thành công",
  LOG_NOT_FOUND: "Không tìm thấy nhật ký sử dụng xe",
  LOG_ACCESS_DENIED: "Bạn không có quyền truy cập nhật ký sử dụng xe này",
  END_ODO_LESS_THAN_START: (endOdo, startOdo) =>
    `Chỉ số kết thúc (${endOdo}) không được nhỏ hơn chỉ số ban đầu (${startOdo})`,
  START_TIME_MUST_BEFORE_END:
    "Thời gian bắt đầu phải trước hoặc bằng thời gian kết thúc",
  END_TIME_MUST_AFTER_START:
    "Thời gian kết thúc phải sau hoặc bằng thời gian bắt đầu",
  FUEL_CONSUMED_INVALID: "Lượng nhiên liệu tiêu thụ phải lớn hơn hoặc bằng 0",
  CHECKOUT_OWN_LOG_ONLY:
    "Bạn chỉ có thể check-out cho nhật ký sử dụng xe của chính mình",
  LOG_ALREADY_CHECKED_OUT: "Nhật ký sử dụng xe này đã được check-out trước đó",
  LOG_ALREADY_DELETED: "Nhật ký sử dụng xe đã bị xóa",
  LOG_NOT_DELETED: "Nhật ký sử dụng xe chưa bị xóa",
};

export const DRIVER_MESSAGES = {
  CREATE_SUCCESS: "Tạo tài xế thành công",
  GET_ALL_SUCCESS: "Lấy danh sách tài xế thành công",
  GET_ONE_SUCCESS: "Lấy thông tin tài xế thành công",
  GET_PROFILE_SUCCESS: "Lấy thông tin tài xế thành công",
  UPDATE_SUCCESS: "Cập nhật tài xế thành công",
  DELETE_SUCCESS: "Xóa tài xế thành công",
  RESTORE_SUCCESS: "Khôi phục tài xế thành công",
  ASSIGN_VEHICLE_SUCCESS: "Gán phương tiện cho tài xế thành công",
  UNASSIGN_VEHICLE_SUCCESS: "Hủy gán phương tiện của tài xế thành công",
  UPDATE_STATUS_SUCCESS: "Cập nhật trạng thái tài xế thành công",
  RENEW_LICENSE_SUCCESS: "Gia hạn giấy phép lái xe thành công",
  NOT_FOUND: "Không tìm thấy tài xế",
  ALREADY_EXISTS: "Người dùng này đã được đăng ký làm tài xế",
  ID_CARD_EXISTS: "Số CCCD/CMND này đã được đăng ký",
  LICENSE_EXISTS: "Số giấy phép lái xe đã tồn tại",
  IDENTITY_CONFLICT: "Thông tin định danh tài xế bị trùng lặp",
  CANNOT_DEACTIVATE_ACTIVE_TRIPS:
    "Không thể ngừng hoạt động tài xế đang có chuyến đi đã lên kế hoạch hoặc đang thực hiện",
  CANNOT_CHANGE_VEHICLE_ACTIVE_TRIPS:
    "Không thể thay đổi phương tiện của tài xế đang có chuyến đi đã lên kế hoạch hoặc đang thực hiện",
  CODE_GEN_FAILED: "Không thể tạo mã tài xế duy nhất. Vui lòng thử lại.",
  EXPIRY_MUST_BE_FUTURE: "Ngày hết hạn giấy phép lái xe phải ở trong tương lai",
};

export const CUSTOMER_MESSAGES = {
  CREATE_SUCCESS: "Tạo khách hàng thành công",
  GET_ALL_SUCCESS: "Lấy danh sách khách hàng thành công",
  GET_ONE_SUCCESS: "Lấy thông tin khách hàng thành công",
  GET_PROFILE_SUCCESS: "Lấy thông tin cá nhân thành công",
  UPDATE_SUCCESS: "Cập nhật thông tin khách hàng thành công",
  UPDATE_PROFILE_SUCCESS: "Cập nhật thông tin cá nhân thành công",
  DELETE_SUCCESS: "Xóa khách hàng thành công",
  NOT_FOUND: "Không tìm thấy thông tin khách hàng",
  ALREADY_EXISTS: "Hồ sơ khách hàng đã tồn tại",
  INVALID_WALLET_DEBIT_AMOUNT: "Số tiền trừ ví không hợp lệ",
  INVALID_WALLET_ADJUSTMENT_AMOUNT: "Số tiền điều chỉnh ví không hợp lệ",
  CODE_GEN_FAILED: "Không thể tạo mã khách hàng duy nhất. Vui lòng thử lại.",
};

export const ADDRESS_MESSAGES = {
  CREATE_SUCCESS: "Tạo địa chỉ thành công",
  GET_ALL_SUCCESS: "Lấy danh sách địa chỉ thành công",
  GET_ONE_SUCCESS: "Lấy thông tin địa chỉ thành công",
  UPDATE_SUCCESS: "Cập nhật địa chỉ thành công",
  DELETE_SUCCESS: "Xóa địa chỉ thành công",
  SET_DEFAULT_SUCCESS: "Đặt địa chỉ mặc định thành công",
  NOT_FOUND: "Không tìm thấy địa chỉ",
  NO_PERMISSION: (action = "truy cập") =>
    `Bạn không có quyền ${action} địa chỉ này`,
  CANNOT_UNSET_DEFAULT:
    "Không thể bỏ chọn địa chỉ mặc định. Vui lòng đặt địa chỉ khác làm mặc định thay thế.",
  CANNOT_DELETE_DEFAULT:
    "Không thể xóa địa chỉ mặc định. Vui lòng đặt địa chỉ khác làm mặc định trước khi xóa.",
};

export const MAINTENANCE_MESSAGES = {
  CREATE_SUCCESS: "Tạo lịch bảo dưỡng thành công",
  GET_ALL_SUCCESS: "Lấy danh sách lịch bảo dưỡng thành công",
  GET_ONE_SUCCESS: "Lấy thông tin lịch bảo dưỡng thành công",
  UPDATE_SUCCESS: "Cập nhật lịch bảo dưỡng thành công",
  DELETE_SUCCESS: "Xóa lịch bảo dưỡng thành công",
  RESTORE_SUCCESS: "Khôi phục lịch bảo dưỡng thành công",
  COMPLETE_SUCCESS: "Hoàn thành bảo dưỡng thành công",
  CANCEL_SUCCESS: "Hủy lịch bảo dưỡng thành công",
  CREATE_LOG_SUCCESS: "Tạo nhật ký bảo dưỡng thành công",
  GET_LOGS_SUCCESS: "Lấy danh sách nhật ký bảo dưỡng thành công",
  GET_LOG_SUCCESS: "Lấy thông tin nhật ký bảo dưỡng thành công",
  UPDATE_LOG_SUCCESS: "Cập nhật nhật ký bảo dưỡng thành công",
  GET_TOTAL_COST_SUCCESS: "Lấy tổng chi phí bảo dưỡng thành công",
  GET_UPCOMING_SUCCESS: "Lấy danh sách bảo dưỡng sắp tới thành công",
  NOT_FOUND: "Không tìm thấy lịch bảo dưỡng",
  ALREADY_DELETED: "Lịch bảo dưỡng đã bị xóa",
  NOT_DELETED: "Lịch bảo dưỡng chưa bị xóa",
  LOG_NOT_FOUND: "Không tìm thấy nhật ký bảo dưỡng",
  FREQUENCY_MUST_BE_GREATER_THAN_ZERO: "Tần suất bảo dưỡng phải lớn hơn 0",
  UPDATE_LOG_OWN_VEHICLE_ONLY:
    "Bạn chỉ có thể cập nhật nhật ký bảo dưỡng cho xe được phân công cho mình",
  VEHICLE_IN_USE:
    "Phương tiện đang được sử dụng trong chuyến đi, không thể đưa vào bảo dưỡng",
  VEHICLE_RETIRED: "Phương tiện đã ngừng hoạt động, không thể bảo dưỡng",
  SCHEDULE_NOT_BELONG_TO_VEHICLE:
    "Lịch bảo dưỡng không thuộc về phương tiện này",
  LOG_ID_REQUIRED: "Mã nhật ký bảo dưỡng là bắt buộc",
  DATE_RANGE_REQUIRED: "Ngày bắt đầu và ngày kết thúc là bắt buộc",
  VEHICLE_AND_DATE_RANGE_REQUIRED:
    "Mã phương tiện, ngày bắt đầu và ngày kết thúc là bắt buộc",
  INVALID_VEHICLE_ID: "Định dạng mã phương tiện không hợp lệ",
  ALREADY_COMPLETED: "Lịch bảo dưỡng này đã hoàn thành",
  ALREADY_CANCELLED: "Lịch bảo dưỡng này đã bị hủy",
  INVALID_LOG_STATUS_TRANSITION:
    "Không thể chuyển trạng thái nhật ký bảo dưỡng theo yêu cầu",
  LOG_STATUS_CHANGED:
    "Nhật ký bảo dưỡng đã được cập nhật bởi yêu cầu khác. Vui lòng tải lại dữ liệu.",
};

export const STAFF_MESSAGES = {
  CREATE_SUCCESS: "Tạo nhân viên kho thành công",
  GET_ALL_SUCCESS: "Lấy danh sách nhân viên kho thành công",
  GET_ONE_SUCCESS: "Lấy thông tin nhân viên kho thành công",
  GET_PROFILE_SUCCESS: "Lấy thông tin cá nhân nhân viên thành công",
  UPDATE_SUCCESS: "Cập nhật nhân viên kho thành công",
  DELETE_SUCCESS: "Xóa nhân viên kho thành công",
  RESTORE_SUCCESS: "Khôi phục nhân viên kho thành công",
  TRANSFER_WAREHOUSE_SUCCESS: "Điều chuyển kho cho nhân viên thành công",
  NOT_FOUND: "Không tìm thấy nhân viên kho",
  ALREADY_EXISTS: "Hồ sơ nhân viên đã tồn tại cho người dùng này",
  CODE_GEN_FAILED: "Không thể tạo mã nhân viên duy nhất. Vui lòng thử lại.",
};

export const INVENTORY_MESSAGES = {
  GET_ALL_SUCCESS: "Lấy danh sách tồn kho thành công",
  GET_ONE_SUCCESS: "Lấy thông tin tồn kho thành công",
  UPDATE_SUCCESS: "Cập nhật tồn kho thành công",
  GET_SUMMARY_SUCCESS: "Lấy tổng quan tồn kho thành công",
  NOT_FOUND: "Không tìm thấy thông tin tồn kho",
  ALREADY_DELETED: "Hàng tồn kho đã bị xóa trước đó",
  QTY_MUST_BE_GREATER_THAN_ZERO: "Số lượng phải lớn hơn 0",
  ALREADY_IN_STOCK:
    "Đơn hàng đã có trong kho này. Cần phải xuất kho trước khi nhập lại",
  RECORD_NOT_FOUND: "Không tìm thấy thông tin tồn kho cho đơn hàng này",
  WAREHOUSE_AND_ORDER_REQUIRED: "Mã kho và mã đơn hàng là bắt buộc",
  INVALID_CONDITION:
    "Tình trạng hàng hóa không hợp lệ. Phải là 'good' hoặc 'damaged'",
  LOCATION_EMPTY: "Vị trí lưu kho không được để trống",
  CANNOT_UPDATE_NOT_IN_STOCK:
    "Không thể cập nhật cho hàng hóa không còn trong kho",
  CONCURRENT_MODIFICATION:
    "Không thể cập nhật vì dữ liệu tồn kho vừa thay đổi. Vui lòng tải lại và thử lại",
  INVALID_STATUS:
    "Trạng thái tồn kho không hợp lệ. Phải là 'in_stock' hoặc 'issued'",
  QTY_MUST_BE_NON_NEGATIVE: "Số lượng phải lớn hơn hoặc bằng 0",
  ALREADY_ISSUED: "Hàng hóa của đơn hàng này đã được xuất kho",
  CONCURRENT_UPDATE_ERROR:
    "Xuất kho thất bại do có thao tác cập nhật đồng thời. Vui lòng thử lại",
  UNAUTHORIZED_VIEW_DIFFERENT_WAREHOUSE:
    "Bạn không có quyền xem tồn kho của kho khác",
  UNAUTHORIZED_UPDATE_DIFFERENT_WAREHOUSE:
    "Bạn không có quyền cập nhật tồn kho của kho khác",
  UNAUTHORIZED_DELETE_DIFFERENT_WAREHOUSE:
    "Bạn không có quyền xóa tồn kho của kho khác",
};

export const RECEIPT_MESSAGES = {
  CREATE_SUCCESS: "Tạo phiếu nhập kho thành công",
  GET_ALL_SUCCESS: "Lấy danh sách phiếu nhập kho thành công",
  GET_ONE_SUCCESS: "Lấy thông tin phiếu nhập kho thành công",
  UPDATE_SUCCESS: "Cập nhật phiếu nhập kho thành công",
  CANCEL_SUCCESS: "Hủy phiếu nhập kho thành công",
  NOT_FOUND: "Không tìm thấy phiếu nhập kho",
  QTY_GREATER_THAN_ZERO: "Số lượng phải lớn hơn 0",
  STAFF_NOT_ASSIGNED: "Nhân viên kho chưa được phân bổ vào kho nào",
  NOT_AUTHORIZED_WAREHOUSE: "Bạn không có quyền tạo phiếu nhập cho kho này",
  ORDER_STATUS_INVALID: (status) =>
    `Không thể tạo phiếu nhập cho đơn hàng có trạng thái '${status}'`,
  QTY_MISMATCH: (quantity, orderQuantity) =>
    `Số lượng nhập (${quantity}) phải khớp với số lượng đơn hàng (${orderQuantity}). Hệ thống chưa hỗ trợ nhập một phần`,
  CATEGORY_MISMATCH: "Danh mục hàng hóa không khớp với danh mục của đơn hàng",
  CATEGORY_REQUIRED: "Mã danh mục hàng hóa là bắt buộc",
  RECEIVED_BY_REQUIRED: "Mã người nhận hàng là bắt buộc",
  ORDER_ALREADY_IN_STOCK:
    "Đơn hàng đã có trong kho này. Cần phải xuất kho trước khi nhập lại",
  ORDER_IN_ANOTHER_WAREHOUSE:
    "Đơn hàng hiện đang ở kho khác. Cần xuất kho từ kho đó trước khi nhập vào đây",
  CODE_GEN_FAILED: "Không thể tạo mã phiếu nhập duy nhất. Vui lòng thử lại",
  ORDER_PROCESSING: "Đơn hàng đang được xử lý hoặc đang được nhập vào kho này",
  ALREADY_CANCELLED: "Không thể hủy phiếu nhập đã bị hủy trước đó",
  CANCEL_NOT_AUTHORIZED:
    "Bạn không có quyền hủy phiếu nhập này. Chỉ Quản trị viên, Quản lý kho hoặc nhân viên tạo phiếu mới có thể hủy",
  CANCEL_FAILED_MODIFIED:
    "Hủy phiếu nhập thất bại: Phiếu nhập đã bị hủy hoặc đã qua chỉnh sửa",
  CANNOT_CANCEL_NOT_IN_STOCK:
    "Không thể hủy phiếu nhập kho vì hàng hóa không còn tồn trong kho (hoặc đã được xuất đi)",
  CANNOT_RESTORE_ORDER_STATUS:
    "Không thể hủy phiếu nhập kho vì không xác định được trạng thái đơn hàng trước đó",
  CANNOT_UPDATE_CANCELLED:
    "Không thể cập nhật phiếu nhập đã hủy. Vui lòng tạo phiếu nhập mới",
  CANNOT_MODIFY_CORE:
    "Không thể sửa các thông tin cốt lõi (kho, đơn hàng, số lượng). Vui lòng hủy phiếu và tạo mới",
  CANNOT_MODIFY_NOT_IN_STOCK:
    "Không thể sửa tình trạng phiếu nhập vì hàng hóa không còn tồn trong kho",
};

export const ISSUE_MESSAGES = {
  CREATE_SUCCESS: "Tạo phiếu xuất kho thành công",
  GET_ALL_SUCCESS: "Lấy danh sách phiếu xuất kho thành công",
  GET_ONE_SUCCESS: "Lấy thông tin phiếu xuất kho thành công",
  GET_BY_TRIP_SUCCESS: "Lấy danh sách phiếu xuất kho theo chuyến xe thành công",
  UPDATE_SUCCESS: "Cập nhật phiếu xuất kho thành công",
  CANCEL_SUCCESS: "Hủy phiếu xuất kho thành công",
  NOT_FOUND: "Không tìm thấy phiếu xuất kho",
  QTY_GREATER_THAN_ZERO: "Số lượng phải lớn hơn 0",
  STAFF_NOT_ASSIGNED: "Nhân viên kho chưa được phân bổ vào kho nào",
  NOT_AUTHORIZED_WAREHOUSE: "Bạn không có quyền tạo phiếu xuất cho kho này",
  ORDER_NOT_IN_STOCK: "Đơn hàng không có sẵn trong kho để xuất",
  QTY_EXCEEDS_STOCK: (quantity, stock) =>
    `Số lượng xuất (${quantity}) vượt quá số lượng tồn kho (${stock})`,
  CODE_GEN_FAILED: "Không thể tạo mã phiếu xuất duy nhất. Vui lòng thử lại",
  ALREADY_CANCELLED: "Không thể hủy phiếu xuất đã bị hủy trước đó",
  CANCEL_NOT_AUTHORIZED:
    "Bạn không có quyền hủy phiếu xuất này. Chỉ Quản trị viên, Quản lý kho hoặc nhân viên tạo phiếu mới có thể hủy",
  TRIP_STATUS_INVALID: (status) =>
    `Không thể xuất hàng cho chuyến đi có trạng thái '${status}'. Chuyến xe phải ở trạng thái 'planned' hoặc 'in_progress'`,
  ORDER_STATUS_NOT_STORED: (status) =>
    `Không thể xuất đơn hàng có trạng thái '${status}'. Chỉ có thể xuất các đơn hàng đang ở trạng thái 'stored' trong kho`,
  ORDER_NOT_ASSIGNED_TRIP:
    "Đơn hàng chưa được phân công vào chuyến xe nào bởi điều phối viên. Vui lòng phân công đơn hàng vào chuyến xe này trước",
  ORDER_ASSIGNED_DIFFERENT_TRIP:
    "Đơn hàng đã được phân công vào một chuyến xe khác",
  ISSUED_BY_REQUIRED: "Mã người xuất hàng là bắt buộc",
  INVENTORY_NOT_FOUND:
    "Không tìm thấy mặt hàng tồn kho cho đơn hàng này trong kho được chỉ định",
  INVENTORY_NOT_IN_STOCK: "Hàng tồn kho không còn trong kho để xuất",
  CANNOT_ISSUE_DAMAGED:
    "Không thể xuất hàng hóa bị hư hỏng. Vui lòng kiểm tra và xử lý hư hỏng trước",
  QTY_MISMATCH: (qty) =>
    `Số lượng xuất phải khớp với số lượng tồn kho (${qty}). Hệ thống chưa hỗ trợ xuất một phần`,
  CATEGORY_MISMATCH: "Danh mục hàng hóa không khớp với hàng tồn kho",
  CANNOT_CANCEL_ORDER_STATUS: (status) =>
    `Không thể hủy phiếu xuất kho vì trạng thái đơn hàng hiện tại là '${status}'`,
  CANNOT_CANCEL_TRIP_STATUS: (status) =>
    `Không thể hủy phiếu xuất kho vì trạng thái chuyến xe hiện tại là '${status}'. Chỉ được phép hủy khi chuyến xe ở trạng thái 'planned'`,
  CANCEL_FAILED_INVENTORY_NOT_FOUND:
    "Không thể hủy xuất kho: Không tìm thấy mặt hàng tồn kho của đơn hàng này trong kho",
  CANCEL_FAILED_MODIFIED:
    "Hủy phiếu xuất kho thất bại: Phiếu xuất đã bị hủy hoặc đã qua chỉnh sửa",
  CANCEL_FAILED_NOT_ISSUED:
    "Hủy phiếu xuất kho thất bại: Hàng tồn kho không còn ở trạng thái đã xuất",
  CANNOT_UPDATE_CANCELLED:
    "Không thể cập nhật ghi chú cho phiếu xuất kho đã bị hủy",
};

export const GOODS_CATEGORY_MESSAGES = {
  CREATE_SUCCESS: "Tạo danh mục hàng hóa thành công",
  GET_ALL_SUCCESS: "Lấy danh sách danh mục hàng hóa thành công",
  GET_ONE_SUCCESS: "Lấy thông tin danh mục hàng hóa thành công",
  UPDATE_SUCCESS: "Cập nhật danh mục hàng hóa thành công",
  DELETE_SUCCESS: "Xóa danh mục hàng hóa thành công",
  RESTORE_SUCCESS: "Khôi phục danh mục hàng hóa thành công",
  NOT_FOUND: "Không tìm thấy danh mục hàng hóa",
  ALREADY_DELETED: "Danh mục hàng hóa đã bị xóa",
  NAME_EXISTS: "Tên danh mục hàng hóa đã tồn tại",
  PREVIOUSLY_DELETED:
    "Danh mục hàng hóa với tên này đã bị xóa trước đó. Vui lòng khôi phục thay vì tạo mới.",
  CANNOT_DELETE_HAS_STOCK: (count) =>
    `Không thể xóa danh mục hàng hóa: Hiện đang có ${count} mặt hàng trong kho`,
  CANNOT_DELETE_ACTIVE_ORDERS: (count) =>
    `Không thể xóa danh mục hàng hóa: Hiện đang được liên kết với ${count} đơn hàng đang xử lý`,
  NOT_DELETED: "Danh mục hàng hóa chưa bị xóa",
  CANNOT_RESTORE_NAME_EXISTS:
    "Không thể khôi phục: Đã tồn tại một danh mục hàng hóa đang hoạt động có cùng tên",
};

export const ROUTE_MESSAGES = {
  CREATE_SUCCESS: "Tạo tuyến đường thành công",
  GET_ALL_SUCCESS: "Lấy danh sách tuyến đường thành công",
  GET_ONE_SUCCESS: "Lấy thông tin tuyến đường thành công",
  UPDATE_SUCCESS: "Cập nhật tuyến đường thành công",
  DELETE_SUCCESS: "Xóa tuyến đường thành công",
  RESTORE_SUCCESS: "Khôi phục tuyến đường thành công",
  ORIGIN_REQUIRED: "Điểm xuất phát là bắt buộc",
  DESTINATION_REQUIRED: "Điểm đến là bắt buộc",
  DISTANCE_REQUIRED: "Khoảng cách là bắt buộc",
  DURATION_REQUIRED: "Thời gian dự kiến là bắt buộc",
  IDENTICAL_ORIGIN_DEST: "Điểm xuất phát và điểm đến không thể giống nhau",
  DISTANCE_MUST_POSITIVE: "Khoảng cách phải là số dương lớn hơn 0",
  DURATION_MUST_POSITIVE: "Thời gian dự kiến phải là số dương lớn hơn 0",
  NOT_FOUND: "Không tìm thấy tuyến đường",
  ALREADY_DELETED: "Tuyến đường đã bị xóa",
  ALREADY_EXISTS: (origin, destination) =>
    `Tuyến đường từ '${origin}' đến '${destination}' đã tồn tại`,
  CANNOT_CHANGE_ORIGIN_WITH_TRIPS:
    "Không thể đổi kho đi vì chuyến gắn với tuyến không khớp kho đi mới",
  CANNOT_DELETE_ACTIVE_TRIPS: (count) =>
    `Không thể xóa tuyến đường: Hiện đang liên kết với ${count} chuyến đi đang hoạt động`,
  CANNOT_DELETE_ACTIVE_ORDERS: (count) =>
    `Không thể xóa tuyến đường: Hiện đang liên kết với ${count} đơn hàng đang hoạt động`,
  NOT_DELETED: "Tuyến đường chưa bị xóa",
};

export const TRIP_MESSAGES = {
  CREATE_SUCCESS: "Tạo chuyến xe thành công",
  GET_ALL_SUCCESS: "Lấy danh sách chuyến xe thành công",
  GET_ONE_SUCCESS: "Lấy thông tin chuyến xe thành công",
  GET_BY_CODE_SUCCESS: "Lấy thông tin chuyến xe theo mã thành công",
  UPDATE_SUCCESS: "Cập nhật chuyến xe thành công",
  DELETE_SUCCESS: "Xóa chuyến xe thành công",
  RESTORE_SUCCESS: "Khôi phục chuyến xe thành công",
  REASSIGN_SUCCESS: "Điều phối lại tài xế và phương tiện thành công",
  GET_ASSIGNMENTS_SUCCESS: "Lấy lịch sử điều phối chuyến xe thành công",
  GET_AUDIT_LOGS_SUCCESS: "Lấy lịch sử thay đổi chuyến xe thành công",
  START_SUCCESS: "Bắt đầu chuyến xe thành công",
  COMPLETE_SUCCESS: "Hoàn thành chuyến xe thành công",
  CANCEL_SUCCESS: "Hủy chuyến xe thành công",
  ADD_LOG_SUCCESS: "Thêm nhật ký hành trình thành công",
  GET_LOGS_SUCCESS: "Lấy nhật ký hành trình thành công",
  GET_LATEST_LOG_SUCCESS: "Lấy nhật ký hành trình mới nhất thành công",
  ADD_EXPENSE_SUCCESS: "Thêm chi phí chuyến xe thành công",
  GET_EXPENSES_SUCCESS: "Lấy danh sách chi phí chuyến xe thành công",
  GET_TOTAL_EXPENSES_SUCCESS: "Lấy tổng chi phí chuyến xe thành công",
  UPDATE_EXPENSE_SUCCESS: "Cập nhật chi phí chuyến xe thành công",
  DELETE_EXPENSE_SUCCESS: "Xóa chi phí chuyến xe thành công",
  NOT_FOUND: "Không tìm thấy chuyến xe",
  ALREADY_DELETED: "Chuyến xe đã bị xóa trước đó",
  VEHICLE_BUSY: (tripCode) =>
    `Phương tiện đã được lên lịch cho chuyến ${tripCode} trong khoảng thời gian này`,
  DRIVER_BUSY: (tripCode) =>
    `Tài xế đã được lên lịch cho chuyến ${tripCode} trong khoảng thời gian này`,
  START_BEFORE_END:
    "Thời gian bắt đầu dự kiến phải sớm hơn thời gian kết thúc dự kiến",
  DRIVER_NOT_ACTIVE: "Tài xế hiện không ở trạng thái hoạt động",
  VEHICLE_STATUS_INVALID: (status) =>
    `Không thể gán phương tiện vì trạng thái là '${status}'`,
  CODE_GEN_FAILED: "Không thể tạo mã chuyến xe duy nhất. Vui lòng thử lại",
  SCHEDULE_RESOURCE_UNAVAILABLE:
    "Phương tiện hoặc tài xế không còn khả dụng để lên lịch chuyến xe",
  TRIP_CHANGED_RETRY:
    "Chuyến xe vừa được cập nhật. Vui lòng tải lại và thử lại thao tác",
  CANNOT_DELETE_IN_PROGRESS:
    "Không thể xóa chuyến xe đang trong quá trình thực hiện",
  CANNOT_DELETE_ACTIVE_ORDERS: (count) =>
    `Không thể xóa chuyến xe: Hiện đang liên kết với ${count} đơn hàng`,
  TRIP_TYPE_HAS_ORDERS:
    "Không thể đổi loại chuyến khi chuyến đang có đơn hàng được gán",
  NOT_DELETED: "Chuyến xe chưa bị xóa",
  CANNOT_REASSIGN_STATUS: (status) =>
    `Không thể phân công lại tài xế hoặc phương tiện cho chuyến xe ở trạng thái '${status}'`,
  CANNOT_REASSIGN_IN_PROGRESS:
    "Không thể đổi tài xế hoặc phương tiện khi chuyến đang diễn ra. Vui lòng thực hiện trước khi khởi hành hoặc tạo chuyến chuyển tiếp riêng.",
  REASSIGN_PARAMS_REQUIRED:
    "Vui lòng cung cấp newDriverId hoặc newVehicleId để phân công lại",
  REASSIGN_ENDPOINT_REQUIRED:
    "Vui lòng sử dụng chức năng phân công lại để thay đổi tài xế hoặc phương tiện",
  NEW_DRIVER_NOT_ACTIVE: "Tài xế mới không ở trạng thái hoạt động",
  NEW_VEHICLE_NOT_AVAILABLE: (status) =>
    `Phương tiện mới không khả dụng (trạng thái: ${status})`,
  DRIVER_REQUIRED_FOR_WAREHOUSE_SCOPE:
    "Không xác định được kho của chuyến đi vì chuyến chưa được gán tài xế",
  DRIVER_WAREHOUSE_MISMATCH: "Tài xế phải thuộc cùng kho với chuyến đi",
  VEHICLE_WAREHOUSE_MISMATCH: "Phương tiện phải thuộc cùng kho với chuyến đi",
  ROUTE_ORIGIN_WAREHOUSE_MISMATCH:
    "Kho vận hành của chuyến phải là kho đi của tuyến",
  ROUTE_REQUIRED: "Chuyến giao hoặc trung chuyển phải có tuyến đường",
  ROUTE_HAS_ORDERS: "Không thể đổi tuyến vì chuyến đã có đơn hàng khác tuyến",
  TOTAL_ORDER_SYSTEM_MANAGED: "Tổng số đơn của chuyến được hệ thống tự tính",
  CANNOT_LOG_STATUS: (status) =>
    `Không thể thêm nhật ký cho chuyến xe đã ở trạng thái ${status}`,
  NOT_ASSIGNED_DRIVER: "Bạn không phải là tài xế được phân công cho chuyến này",
  CANNOT_COMPLETE_STATUS:
    "Không thể hoàn thành chuyến xe chưa khởi hành hoặc chưa chuyển sang trạng thái đang thực hiện",
  LOG_NOT_FOUND: "Không tìm thấy nhật ký hành trình cho chuyến xe này",
  EXPENSE_AMOUNT_POSITIVE: "Số tiền chi phí phải lớn hơn 0",
  EXPENSE_NOT_FOUND: "Không tìm thấy chi phí chuyến xe",
  EXPENSE_DELETE_OWN_ONLY: "Bạn chỉ có thể xóa chi phí do chính mình tạo",
};

export const FAILURE_REASON_MESSAGES = {
  CREATE_SUCCESS: "Báo cáo sự cố giao hàng thành công",
  GET_ALL_SUCCESS: "Lấy danh sách sự cố thành công",
  GET_ONE_SUCCESS: "Lấy chi tiết sự cố thành công",
  GET_ORDER_LOGS_SUCCESS: "Lấy danh sách sự cố của đơn hàng thành công",
  GET_TRIP_LOGS_SUCCESS: "Lấy danh sách sự cố của chuyến xe thành công",
  GET_STATS_SUCCESS: "Lấy thống kê sự cố thành công",
  UPDATE_SUCCESS: "Cập nhật báo cáo sự cố thành công",
  DELETE_SUCCESS: "Xóa báo cáo sự cố thành công",
  NOT_FOUND: "Không tìm thấy nhật ký sự cố",
  NOT_ASSIGNED_DRIVER: "Bạn không phải là tài xế được phân công cho chuyến này",
  CONCURRENT_UPDATE_ERROR:
    "Không thể cập nhật lần giao do đơn hàng vừa được cập nhật. Vui lòng thử lại",
  CANNOT_REPORT_STATUS: (status) =>
    `Không thể báo cáo sự cố cho đơn hàng có trạng thái '${status}'`,
  ORDER_NOT_IN_TRIP: "Đơn hàng không thuộc về chuyến xe này",
  CANNOT_REPORT_CANCELLED_TRIP:
    "Không thể báo cáo sự cố cho chuyến xe đã bị hủy",
  ACCESS_DENIED:
    "Truy cập bị từ chối. Bạn không phải là chủ sở hữu của đơn hàng này",
  CODE_EXISTS: "Mã lý do thất bại đã tồn tại",
};

export const FEEDBACK_MESSAGES = {
  CREATE_SUCCESS: "Gửi đánh giá thành công",
  REPLY_SUCCESS: "Phản hồi đánh giá thành công",
  GET_ALL_SUCCESS: "Lấy danh sách đánh giá thành công",
  GET_ONE_SUCCESS: "Lấy chi tiết đánh giá thành công",
  GET_ORDER_SUCCESS: "Lấy đánh giá của đơn hàng thành công",
  ORDER_NOT_FOUND: "Không tìm thấy đơn hàng",
  ORDER_NOT_DELIVERED:
    "Chỉ có thể đánh giá những đơn hàng đã được giao thành công",
  CREATE_ACCESS_DENIED: "Bạn không có quyền đánh giá đơn hàng này",
  ALREADY_EXISTS: "Đơn hàng này đã được đánh giá trước đó",
  NOT_FOUND: "Không tìm thấy đánh giá",
  ORDER_FEEDBACK_NOT_FOUND: "Chưa có đánh giá cho đơn hàng này",
  VIEW_ACCESS_DENIED: "Bạn không có quyền xem đánh giá",
  VIEW_ONE_ACCESS_DENIED: "Bạn không có quyền xem đánh giá này",
  REPLY_ACCESS_DENIED:
    "Bạn chỉ có thể phản hồi đánh giá dành cho chuyến đi của mình",
};

export const ORDER_MESSAGES = {
  CREATE_SUCCESS: "Tạo đơn hàng thành công",
  GET_ALL_SUCCESS: "Lấy danh sách đơn hàng thành công",
  GET_MY_ORDERS_SUCCESS: "Lấy danh sách đơn hàng của tôi thành công",
  GET_ONE_SUCCESS: "Lấy thông tin đơn hàng thành công",
  GET_BY_TRIP_SUCCESS: "Lấy danh sách đơn hàng theo chuyến xe thành công",
  UPDATE_SUCCESS: "Cập nhật thông tin đơn hàng thành công",
  DELETE_SUCCESS: "Xóa đơn hàng thành công",
  CANCEL_SUCCESS: "Hủy đơn hàng thành công",
  UPDATE_STATUS_SUCCESS: "Cập nhật trạng thái đơn hàng thành công",
  PICKUP_CONFIRMATION_SUCCESS: "Ghi nhận kết quả lấy hàng thành công",
  MARK_DELIVERED_SUCCESS: "Đánh dấu đơn hàng đã giao thành công",
  ASSIGN_TO_TRIP_SUCCESS: "Gán đơn hàng vào chuyến xe thành công",
  UNASSIGN_FROM_TRIP_SUCCESS: "Gỡ đơn hàng khỏi chuyến xe thành công",
  GET_STATS_SUCCESS: "Lấy thống kê đơn hàng thành công",
  ADD_TRACKING_SUCCESS: "Thêm nhật ký theo dõi đơn hàng thành công",
  GET_TRACKING_SUCCESS: "Lấy lịch sử theo dõi đơn hàng thành công",
  GET_LATEST_TRACKING_SUCCESS:
    "Lấy nhật ký theo dõi đơn hàng mới nhất thành công",
  NOT_FOUND: "Không tìm thấy đơn hàng",
  ALREADY_DELETED: "Đơn hàng đã bị xóa",
  ACCESS_DENIED:
    "Truy cập bị từ chối. Bạn không phải là chủ sở hữu của đơn hàng này",
  CATEGORY_REQUIRED: "Danh mục hàng hóa là bắt buộc",
  CUSTOMER_REQUIRED: "Thông tin khách hàng là bắt buộc",
  CUSTOMER_ROUTE_NOT_ALLOWED:
    "Khách hàng không cần chọn tuyến kho-kho khi tạo đơn",
  PICKUP_LOCATION_REQUIRED:
    "Cần tọa độ điểm lấy hàng để tự động chọn kho gần nhất",
  CODE_GEN_FAILED: "Không thể tạo mã đơn hàng duy nhất. Vui lòng thử lại",
  INVALID_SHIPPING_FEE: "Không thể xác định phí vận chuyển hợp lệ",
  SHIPPING_FEE_ALREADY_PAID:
    "Phí vận chuyển của đơn hàng này đã được thanh toán",
  CANCELLED_ORDER_CANNOT_BE_BILLED:
    "Không thể tạo khoản thanh toán cho đơn hàng đã hủy",
  CANNOT_MODIFY_CORE: (status) =>
    `Không thể sửa đổi thông tin vận chuyển cốt lõi của đơn hàng ở trạng thái '${status}'`,
  CANNOT_MODIFY_SETTLED_FINANCIALS:
    "Không thể thay đổi thông tin COD, phí vận chuyển hoặc khách hàng khi đơn hàng đang được đối soát hoặc đã đối soát",
  COD_AMOUNT_LOCKED_AFTER_COLLECTION:
    "Không thể thay đổi tiền COD sau khi đã thu hoặc nộp COD",
  CUSTOMER_LOCKED_AFTER_COD:
    "Không thể thay đổi khách hàng sau khi đã thu hoặc nộp COD",
  CANNOT_MARK_DELIVERED: (status) =>
    `Không thể đánh dấu đơn hàng đã giao khi trạng thái hiện tại là '${status}'`,
  NOT_DRIVER_OF_TRIP: "Bạn không phải là tài xế được phân công cho chuyến này",
  CANNOT_CANCEL_STATUS: (status) =>
    `Không thể hủy đơn hàng khi trạng thái là '${status}'. Chỉ có thể hủy đơn trước khi lấy hàng`,
  CANCEL_STATUS_CHANGED:
    "Trạng thái đơn hàng vừa thay đổi. Vui lòng tải lại dữ liệu",
  CUSTOMER_FINANCIAL_STATE_CHANGED:
    "Số liệu tài chính của khách hàng vừa thay đổi. Giao dịch đã được hủy",
  ORDER_IDS_REQUIRED_ASSIGN: "Vui lòng cung cấp danh sách orderIds để gán",
  ORDERS_NOT_FOUND: "Một hoặc nhiều đơn hàng không tìm thấy",
  CANNOT_ASSIGN_ORDER_STATUS: (orderCode, status) =>
    `Đơn hàng '${orderCode}' không thể gán vào chuyến khi đang ở trạng thái '${status}'`,
  ORDER_ALREADY_ASSIGNED: "Đơn hàng đã được gán vào một chuyến khác",
  ORDER_TRIP_TYPE_MISMATCH:
    "Đơn hàng chưa nhập kho phải được gán vào chuyến lấy hàng; đơn đã nhập kho chỉ được gán vào chuyến giao hoặc trung chuyển",
  PICKUP_TRIP_REQUIRED:
    "Chỉ có thể xác nhận lấy hàng cho đơn thuộc chuyến lấy hàng",
  PICKUP_TRIP_NOT_IN_PROGRESS:
    "Chỉ có thể xác nhận lấy hàng khi chuyến đang thực hiện",
  PICKUP_ORDER_STATUS_INVALID: (status) =>
    `Không thể xác nhận lấy hàng cho đơn có trạng thái '${status}'`,
  PICKUP_CONFIRMATION_REQUIRED:
    "Vui lòng dùng API xác nhận lấy hàng để cập nhật trạng thái đơn",
  STORAGE_REQUIRES_RECEIPT:
    "Chỉ phiếu nhập kho mới được chuyển đơn hàng sang trạng thái đã nhập kho",
  INVALID_TRACKING_STATUS_TRANSITION: (currentStatus, nextStatus) =>
    `Không thể chuyển trạng thái đơn hàng từ '${currentStatus}' sang '${nextStatus}' qua nhật ký theo dõi`,
  ORDER_TRIP_CHANGE_REQUIRES_ASSIGNMENT:
    "Vui lòng dùng thao tác gán hoặc gỡ đơn khỏi chuyến để thay đổi chuyến của đơn hàng",
  ORDER_ASSIGNMENT_CHANGED:
    "Trạng thái hoặc chuyến của đơn hàng vừa thay đổi. Vui lòng tải lại dữ liệu",
  ROUTE_TRIP_MISMATCH: "Tuyến của đơn hàng không khớp với tuyến của chuyến",
  TRIP_NOT_PLANNED:
    "Chỉ có thể gán đơn vào chuyến đang ở trạng thái đã lên kế hoạch",
  ORDER_IDS_REQUIRED_UNASSIGN: "Vui lòng cung cấp danh sách orderIds để gỡ",
  CANNOT_DELETE_STATUS: (status) =>
    `Chỉ có thể xóa các đơn hàng mới tạo. Trạng thái hiện tại là '${status}'`,
  TRACKING_NOT_FOUND: "Không tìm thấy nhật ký theo dõi cho đơn hàng này",
};

export const DISPATCHER_MESSAGES = {
  CREATE_SUCCESS: "Tạo điều phối viên thành công",
  GET_ALL_SUCCESS: "Lấy danh sách điều phối viên thành công",
  GET_ONE_SUCCESS: "Lấy thông tin điều phối viên thành công",
  GET_PROFILE_SUCCESS: "Lấy thông tin cá nhân điều phối viên thành công",
  UPDATE_SUCCESS: "Cập nhật thông tin điều phối viên thành công",
  DELETE_SUCCESS: "Xóa điều phối viên thành công",
  RESTORE_SUCCESS: "Khôi phục điều phối viên thành công",
  TRANSFER_WAREHOUSE_SUCCESS: "Điều chuyển kho cho điều phối viên thành công",
  UPDATE_STATUS_SUCCESS: "Cập nhật trạng thái điều phối viên thành công",
  GET_DASHBOARD_STATS_SUCCESS: "Lấy thống kê bảng điều khiển thành công",
  GET_RESOURCES_SUCCESS: "Lấy danh sách tài nguyên kho thành công",
  NOT_FOUND: "Không tìm thấy điều phối viên",
  ALREADY_EXISTS: "Hồ sơ điều phối viên đã tồn tại cho người dùng này",
  CODE_ALREADY_EXISTS: "Mã điều phối viên đã tồn tại. Vui lòng thử lại",
  CODE_GEN_FAILED: "Không thể tạo mã điều phối viên duy nhất. Vui lòng thử lại",
};

export const INVOICE_MESSAGES = {
  CREATE_SUCCESS: "Tạo hóa đơn thành công",
  CONSOLIDATE_SUCCESS: "Tạo hóa đơn gộp thành công",
  GET_ALL_SUCCESS: "Lấy danh sách hóa đơn thành công",
  GET_ONE_SUCCESS: "Lấy thông tin hóa đơn thành công",
  UPDATE_SUCCESS: "Cập nhật hóa đơn thành công",
  ISSUE_SUCCESS: "Phát hành hóa đơn thành công",
  CANCEL_SUCCESS: "Hủy hóa đơn thành công",
  GET_STATS_SUCCESS: "Lấy thống kê hóa đơn thành công",
  NOT_FOUND: "Không tìm thấy hóa đơn",
  CUSTOMER_REQUIRED: "Mã khách hàng là bắt buộc để lập hóa đơn",
  DISPATCHER_ORDER_REQUIRED:
    "Điều phối viên chỉ được lập hóa đơn cho đơn hàng thuộc kho",
  DISPATCHER_ORDER_LINK_REQUIRED:
    "Hóa đơn phải được liên kết với đơn hàng thuộc kho",
  ACCESS_DENIED: "Bạn không có quyền truy cập hóa đơn này",
  ALREADY_EXISTS: "Hóa đơn cho đơn hàng này đã tồn tại",
  STATE_CHANGED: "Trạng thái hóa đơn vừa thay đổi. Vui lòng tải lại dữ liệu",
  AMOUNT_MUST_BE_INTEGER: "Các khoản tiền phải là số nguyên",
  AMOUNT_OUT_OF_RANGE: "Số tiền vượt quá giới hạn cho phép",
  CUSTOMER_ORDER_MISMATCH: "Khách hàng trên hóa đơn không khớp với đơn hàng",
  ITEM_AMOUNT_MISMATCH:
    "Thành tiền của từng khoản phải bằng số lượng nhân với đơn giá",
  SUBTOTAL_ITEMS_MISMATCH:
    "Tổng phụ hóa đơn phải khớp với tổng thành tiền các khoản",
  DISCOUNT_EXCEEDS_TOTAL: "Chiết khấu không được lớn hơn tổng phụ cộng thuế",
  CANNOT_PAY_UNISSUED: (status) =>
    `Không thể thanh toán hóa đơn khi chưa phát hành (trạng thái '${status}')`,
  ORDER_NOT_FOUND: "Không tìm thấy đơn hàng tương ứng",
  CANNOT_UPDATE_STATUS: (status) =>
    `Không thể chỉnh sửa hóa đơn khi đã ở trạng thái '${status}'`,
  CANNOT_CANCEL_STATUS: (status) =>
    `Không thể hủy hóa đơn khi đang ở trạng thái '${status}'`,
  ALREADY_PAID: "Hóa đơn đã được thanh toán đầy đủ",
  CANNOT_PAY_CANCELLED: "Không thể thanh toán cho hóa đơn đã bị hủy",
  CODE_GEN_FAILED: "Không thể tạo mã hóa đơn. Vui lòng thử lại",
  NO_ELIGIBLE_ORDERS: "Không có đơn hàng nào hợp lệ để gộp hóa đơn",
  CANNOT_CANCEL_PAID: (paidAmount) =>
    `Không thể hủy hóa đơn đã có khoản thanh toán (${paidAmount}). Vui lòng xử lý hoàn tiền trước.`,
};

export const PAYMENT_MESSAGES = {
  CREATE_SUCCESS: "Tạo giao dịch thanh toán thành công",
  DRIVER_REMIT_SUCCESS:
    "Tài xế nộp tiền COD/cước thành công, chờ đối soát duyệt",
  VERIFY_SUCCESS: "Duyệt giao dịch thanh toán thành công",
  REFUND_SUCCESS: "Hoàn tiền giao dịch thành công",
  GET_ALL_SUCCESS: "Lấy danh sách thanh toán thành công",
  GET_ONE_SUCCESS: "Lấy thông tin giao dịch thanh toán thành công",
  GET_STATS_SUCCESS: "Lấy thống kê dòng tiền thanh toán thành công",
  NOT_FOUND: "Không tìm thấy giao dịch thanh toán",
  INSUFFICIENT_WALLET_BALANCE: "Số dư ví không đủ để thực hiện thanh toán",
  CUSTOMER_REQUIRED_FOR_WALLET: "Không xác định được khách hàng để trừ tiền ví",
  DUPLICATE_COD_ORDER: "Không thể khai báo trùng đơn hàng nộp COD",
  COD_ORDER_NOT_DELIVERED: "Chỉ có thể nộp COD của đơn đã giao thành công",
  COD_ALREADY_SETTLED: "COD của đơn hàng đã được đối soát",
  DRIVER_NOT_ASSIGNED_TO_COD_ORDER:
    "Tài xế không được phép nộp COD của đơn này",
  COD_ORDER_TRIP_MISMATCH: "Đơn hàng không thuộc chuyến xe đã chọn",
  ORDER_HAS_NO_COD: "Đơn hàng không có COD cần nộp",
  INVALID_COD_COLLECTED_AMOUNT: "Số COD đã thu không hợp lệ cho đơn hàng",
  ORDER_NOT_DELIVERED: "Đơn hàng không còn ở trạng thái đã giao",
  COD_AMOUNT_CHANGED: "Số tiền COD đã thay đổi, vui lòng tạo lại phiếu nộp",
  REFUND_EXCEEDS_PAYMENT:
    "Số tiền hoàn không được vượt quá số tiền đã thanh toán",
  REFUND_EXCEEDS_REMAINING: "Số tiền hoàn vượt quá số tiền còn có thể hoàn",
  REFUND_STATE_CHANGED:
    "Trạng thái hoàn tiền vừa thay đổi. Vui lòng tải lại dữ liệu",
  ACCESS_DENIED: "Bạn không có quyền truy cập thanh toán này",
  EXCEEDS_REMAINING_AMOUNT: (remaining) =>
    `Số tiền thanh toán vượt quá số tiền còn lại của hóa đơn (${remaining})`,
  CUSTOMER_PAYER_TYPE_ONLY:
    "Khách hàng chỉ có thể tạo thanh toán với vai trò khách hàng",
  EXCEEDS_ORDER_SHIPPING_BALANCE: (remaining) =>
    `Số tiền thanh toán vượt quá phí vận chuyển còn phải trả (${remaining})`,
  ORDER_PAYMENT_CHANGED:
    "Trạng thái thanh toán đơn hàng vừa thay đổi. Vui lòng thử lại",
  ALREADY_VERIFIED: "Giao dịch này đã được duyệt hoặc xử lý trước đó",
  CANNOT_REFUND_STATUS: (status) =>
    `Chỉ có thể hoàn tiền các giao dịch đã hoàn tất. Trạng thái hiện tại là '${status}'`,
  CODE_GEN_FAILED: "Không thể tạo mã thanh toán. Vui lòng thử lại",
  TOPUP_WALLET_SUCCESS: "Nạp tiền vào ví thành công",
  INVALID_TOPUP_REFERENCE: "Mã giao dịch nạp tiền là bắt buộc",
  DUPLICATE_TOPUP_REFERENCE: "Mã giao dịch nạp tiền này đã được sử dụng",
  GET_WALLET_TRANSACTIONS_SUCCESS: "Lấy lịch sử giao dịch ví thành công",
};

export const WALLET_TRANSACTION_MESSAGES = {
  CREATE_SUCCESS: "Tạo giao dịch ví thành công",
  TOPUP_SUCCESS: "Yêu cầu nạp tiền đã được ghi nhận, chờ xác nhận",
  DUPLICATE_TOPUP_REFERENCE: "Mã giao dịch nạp tiền này đã được sử dụng",
  TOPUP_CUSTOMER_ONLY: "Chỉ khách hàng mới được tạo yêu cầu nạp ví",
  INVALID_TOPUP: "Thông tin nạp ví không hợp lệ",
  INVALID_ADJUSTMENT: "Thông tin điều chỉnh ví không hợp lệ",
  ADJUSTMENT_SUCCESS: "Điều chỉnh số dư ví thành công",
  INSUFFICIENT_BALANCE_FOR_ADJUSTMENT:
    "Số dư ví không đủ để thực hiện điều chỉnh",
  CUSTOMER_REQUIRED_FOR_TOPUP: "Không tìm thấy thông tin khách hàng để nạp ví",
  ADMIN_ONLY_ADJUSTMENT: "Chỉ quản trị viên mới được điều chỉnh ví",
  BALANCE_CHANGED: "Số dư ví đã thay đổi, vui lòng thử lại",
  ACCESS_DENIED: "Bạn không có quyền truy cập giao dịch này",
  GET_ALL_SUCCESS: "Lấy danh sách giao dịch ví thành công",
  GET_ONE_SUCCESS: "Lấy thông tin giao dịch ví thành công",
  NOT_FOUND: "Không tìm thấy giao dịch ví",
};

export const COD_SETTLEMENT_MESSAGES = {
  CREATE_SUCCESS: "Tạo phiếu đối soát COD thành công",
  CONFIRM_SUCCESS: "Xác nhận phiếu đối soát COD thành công",
  COMPLETE_SUCCESS: "Hoàn tất chi trả tiền COD thành công",
  CANCEL_SUCCESS: "Hủy phiếu đối soát thành công",
  GET_ALL_SUCCESS: "Lấy danh sách phiếu đối soát thành công",
  GET_MY_SUCCESS: "Lấy danh sách đối soát COD của bạn thành công",
  GET_ONE_SUCCESS: "Lấy chi tiết phiếu đối soát thành công",
  INVALID_ID: "Định dạng ID không hợp lệ",
  ID_REQUIRED: "ID là bắt buộc",
  ORDER_ID_REQUIRED: "ID đơn hàng là bắt buộc",
  CANCEL_REASON_REQUIRED: "Lý do hủy là bắt buộc",
  CANCEL_REASON_EMPTY: "Lý do hủy không được để trống",
  ORDER_NOT_DELIVERED: "Đơn hàng chưa được giao thành công, không thể đối soát",
  COD_NOT_COLLECTED: "Tiền COD của đơn hàng chưa được thu, không thể đối soát",
  COD_NOT_FULLY_REMITTED: "COD chưa được thu và nộp đủ, không thể đối soát",
  COD_AMOUNT_ZERO: "Đơn hàng không có tiền COD cần đối soát",
  SHIPPING_FEE_NOT_PAID:
    "Phí vận chuyển phải được thanh toán trước khi đối soát COD",
  ORDER_ALREADY_SETTLED: "Đơn hàng này đã được đưa vào phiếu đối soát khác",
  ORDER_CLAIM_CONFLICT:
    "Đơn hàng vừa được đưa vào phiếu đối soát khác. Vui lòng tải lại dữ liệu",
  NOT_FOUND: "Không tìm thấy phiếu đối soát",
  CONFIRM_ONLY_DRAFT: (status) =>
    `Chỉ có thể xác nhận phiếu đối soát ở trạng thái draft. Trạng thái hiện tại: ${status}`,
  COMPLETE_INVALID_STATUS: (status) =>
    `Không thể hoàn tất phiếu đối soát ở trạng thái '${status}'`,
  BANK_TRANSFER_REFERENCE_REQUIRED:
    "Mã tham chiếu chuyển khoản là bắt buộc để hoàn tất phiếu đối soát",
  BANK_DETAILS_INCOMPLETE:
    "Phiếu chuyển khoản thiếu thông tin tài khoản ngân hàng",
  STATUS_CHANGED:
    "Phiếu đối soát vừa thay đổi trạng thái. Vui lòng tải lại dữ liệu",
  CANNOT_CANCEL_COMPLETED: "Không thể hủy phiếu đối soát đã hoàn tất chi trả",
  ALREADY_CANCELLED: "Phiếu đối soát đã được hủy trước đó",
  ACCESS_DENIED: "Bạn không có quyền truy cập phiếu đối soát này",
  CANCEL_REASON: (reason) => `Lý do hủy: ${reason}`,
  COMPLETION_NOTE: (notes) => `Hoàn tất: ${notes}`,
  WALLET_PAYOUT_REASON: "Chi trả COD cho khách hàng",
};

export const NOTIFICATION_MESSAGES = {
  NOT_FOUND: "Không tìm thấy thông báo",
  ACCESS_DENIED: "Bạn không có quyền truy cập thông báo này",
  GET_MY_SUCCESS: "Lấy danh sách thông báo thành công",
  MARK_AS_READ_SUCCESS: "Đã đánh dấu thông báo là đã đọc",
  MARK_ALL_AS_READ_SUCCESS: "Đã đánh dấu tất cả thông báo là đã đọc",
};

export const PRICING_MESSAGES = {
  CALCULATE_SUCCESS: "Tính cước vận chuyển thành công",
  CREATE_RATE_SUCCESS: "Tạo bảng cước thành công",
  GET_ALL_RATES_SUCCESS: "Lấy danh sách bảng cước thành công",
  GET_RATE_SUCCESS: "Lấy thông tin bảng cước thành công",
  UPDATE_RATE_SUCCESS: "Cập nhật bảng cước thành công",
  DELETE_RATE_SUCCESS: "Xóa bảng cước thành công",
};

const MESSAGES = {
  COMMON: COMMON_MESSAGES,
  AUTH: AUTH_MESSAGES,
  USER: USER_MESSAGES,
  ADMIN: ADMIN_MESSAGES,
  WAREHOUSE: WAREHOUSE_MESSAGES,
  VEHICLE: VEHICLE_MESSAGES,
  DRIVER: DRIVER_MESSAGES,
  CUSTOMER: CUSTOMER_MESSAGES,
  ADDRESS: ADDRESS_MESSAGES,
  MAINTENANCE: MAINTENANCE_MESSAGES,
  STAFF: STAFF_MESSAGES,
  INVENTORY: INVENTORY_MESSAGES,
  RECEIPT: RECEIPT_MESSAGES,
  ISSUE: ISSUE_MESSAGES,
  GOODS_CATEGORY: GOODS_CATEGORY_MESSAGES,
  ROUTE: ROUTE_MESSAGES,
  TRIP: TRIP_MESSAGES,
  FAILURE_REASON: FAILURE_REASON_MESSAGES,
  ORDER: ORDER_MESSAGES,
  DISPATCHER: DISPATCHER_MESSAGES,
  INVOICE: INVOICE_MESSAGES,
  PAYMENT: PAYMENT_MESSAGES,
  WALLET_TRANSACTION: WALLET_TRANSACTION_MESSAGES,
  COD_SETTLEMENT: COD_SETTLEMENT_MESSAGES,
  NOTIFICATION: NOTIFICATION_MESSAGES,
  PRICING: PRICING_MESSAGES,
};

export default MESSAGES;
